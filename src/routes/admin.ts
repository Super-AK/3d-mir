import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import { config, type PricingConfig } from '../config.js';
import { getDb } from '../db/index.js';
import { render, imagePreview, UPLOAD_PREFIX } from '../lib/render.js';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
  ProductImageError,
  deleteProductImageFiles,
  mediaFile,
  storeProductImage,
  type UploadedImage,
} from '../lib/product-images.js';
import { resetMailTransporter, sendMail } from '../lib/mailer.js';
import { notifyAdmin } from '../lib/notifications.js';
import { cleanText, isSameOrigin } from '../lib/http.js';
import {
  clearSessionCookie,
  createSession,
  csrfToken,
  destroySession,
  getSession,
  hashPassword,
  setSessionCookie,
  verifyCsrf,
  verifyCsrfToken,
  verifyPassword,
  writeAudit,
} from '../lib/auth.js';
import {
  clearPricingOverrides,
  getPricingConfig,
  getPricingOverrides,
  savePricingOverrides,
  type PricingOverrides,
} from '../lib/pricing-config.js';
import {
  findPaymentMethod,
  getPublicPaymentMethods,
  getShopSettings,
  isBankConfigured,
  paymentMethodLabel,
  saveShopSettings,
  type BankDetails,
  type PaymentMethodSetting,
} from '../lib/shop-settings.js';
import { isStripeConfigured } from '../lib/payments/stripe.js';
import {
  markOrderPaid,
  markOrderPaymentFailed,
  markOrderRefunded,
  paymentProviderLabel,
  paymentStatusLabel,
  paymentStatusTone,
  releaseStock,
  sendPaymentConfirmed,
} from '../lib/payments/index.js';
import {
  getNotificationOverrides,
  getNotificationSettings,
  isSmtpConfigured,
  isTelegramConfigured,
  notificationChannelLabel,
  saveNotificationSettings,
  type NotificationChannel,
  type NotificationSettings,
} from '../lib/notification-settings.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { formatEuro } from '../lib/shop.js';
import { countries, isKnownCountry } from '../lib/countries.js';
import {
  getContactSettings,
  saveContactSettings,
  type ContactReviewMode,
  type ContactSettings,
  type UnknownCountryBehavior,
} from '../lib/contact-settings.js';
import { contactMailHtml, contactMailText } from '../lib/contact-mail.js';
import { geoipStatus } from '../lib/geoip.js';
import {
  allCategories,
  categoryIdsForProduct,
  createCategory,
  deleteCategory,
  saveProductCategories,
  updateCategory,
} from '../lib/categories.js';
import {
  getPublicationSettings,
  savePublicationSettings,
  type PublicationSettings,
} from '../lib/publication-settings.js';

const db = () => getDb();

/**
 * Führt den Etsy-Import als separaten Prozess aus.
 *
 * Der Import lädt viele Bilder und kann einige Minuten dauern; ein eigener
 * Prozess hält die Webserver-Schleife frei. Es läuft immer nur ein Import.
 */
type EtsyImportJob = {
  running: boolean;
  ok: boolean;
  output: string;
  startedAt: number;
  finishedAt: number | null;
};

let etsyImportJob: EtsyImportJob = { running: false, ok: false, output: '', startedAt: 0, finishedAt: null };

/**
 * Startet den Import im Hintergrund und aktualisiert den Job-Status.
 *
 * Der Import dauert wegen der Bilder mehrere Minuten; ein synchroner Request
 * würde am Proxy-Timeout (NGINX) scheitern. Die Admin-Seite fragt den Status
 * deshalb regelmäßig ab.
 */
function startEtsyImport(args: string[], extraEnv: Record<string, string> = {}, cleanupPath = ''): void {
  const binary = path.join(config.root, 'node_modules', '.bin', 'tsx');
  const script = path.join(config.root, 'scripts', 'import-etsy.ts');
  etsyImportJob = {
    running: true,
    ok: false,
    output: 'Import gestartet …\n',
    startedAt: Date.now(),
    finishedAt: null,
  };

  let child: ReturnType<typeof spawn>;
  const cleanup = (): void => {
    if (cleanupPath) {
      try {
        fs.rmSync(cleanupPath, { recursive: true, force: true });
      } catch {
        // Temporäre Dateien sind nicht kritisch.
      }
    }
  };

  try {
    child = spawn(binary, [script, ...args], {
      cwd: config.root,
      env: { ...process.env, ...extraEnv },
    });
  } catch (error) {
    etsyImportJob = {
      ...etsyImportJob,
      running: false,
      ok: false,
      output: `${etsyImportJob.output}${error instanceof Error ? error.message : String(error)}`,
      finishedAt: Date.now(),
    };
    cleanup();
    return;
  }

  const append = (chunk: Buffer): void => {
    etsyImportJob.output += chunk.toString();
    if (etsyImportJob.output.length > 50_000) etsyImportJob.output = etsyImportJob.output.slice(-50_000);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);

  const timer = setTimeout(() => {
    append(Buffer.from('\nZeitüberschreitung: Import wurde abgebrochen.\n'));
    child.kill('SIGKILL');
  }, 15 * 60 * 1000);

  child.on('error', (error) => {
    clearTimeout(timer);
    etsyImportJob = {
      ...etsyImportJob,
      running: false,
      ok: false,
      output: `${etsyImportJob.output}\n${error.message}`,
      finishedAt: Date.now(),
    };
    cleanup();
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    etsyImportJob = {
      ...etsyImportJob,
      running: false,
      ok: code === 0,
      finishedAt: Date.now(),
    };
    cleanup();
  });
}

const orderStatuses = [
  { id: 'neu', label: 'Neu' },
  { id: 'bezahlt', label: 'Bezahlt' },
  { id: 'in_druck', label: 'In Druck' },
  { id: 'versandt', label: 'Versandt' },
  { id: 'abgeschlossen', label: 'Abgeschlossen' },
  { id: 'storniert', label: 'Storniert' },
] as const;

const quoteStatuses = [
  { id: 'neu', label: 'Neu' },
  { id: 'geprueft', label: 'Geprüft' },
  { id: 'angebot_gesendet', label: 'Angebot gesendet' },
  { id: 'angenommen', label: 'Angenommen' },
  { id: 'abgelehnt', label: 'Abgelehnt' },
  { id: 'abgeschlossen', label: 'Abgeschlossen' },
] as const;

type OrderStatus = (typeof orderStatuses)[number]['id'];
type QuoteStatus = (typeof quoteStatuses)[number]['id'];

const paymentStatuses = ['offen', 'in_bearbeitung', 'bezahlt', 'fehlgeschlagen', 'erstattet', 'storniert'].map(
  (id) => ({ id, label: paymentStatusLabel(id) }),
);

type OrderRow = {
  id: number;
  order_number: string;
  status: OrderStatus;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  street: string;
  address_extra: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  payment_method: string;
  payment_status: string;
  payment_provider: string;
  payment_reference: string;
  payment_note: string;
  paid_at: string | null;
  public_token: string;
  stock_reserved: number;
  stock_released_at: string | null;
  shipping_method: string;
  shipping_cents: number;
  options_cents: number;
  subtotal_cents: number;
  total_cents: number;
  customer_note: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: number;
  name: string;
  variant: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

type QuoteRow = {
  id: number;
  reference: string;
  status: QuoteStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  material_id: string;
  color: string;
  printer_id: string;
  infill: number;
  layer_height: number;
  quantity: number;
  coating: string;
  scale_percent: number;
  unit: string;
  dimensions: string;
  volume_cm3: number;
  surface_cm2: number;
  weight_g: number;
  estimated_price_cents: number;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_sha256: string | null;
  consent_at: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  country: string;
  review_status: string;
  review_reason: string;
  handled: number;
  replied_at: string | null;
  reply_subject: string;
  reply_text: string;
  created_at: string;
};

type ProductRow = {
  id: number;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price_from_cents: number;
  price_to_cents: number | null;
  sku: string | null;
  weight_g: number | null;
  dimensions: string | null;
  stock: number | null;
  active: number;
  sort_order: number;
  shipping_method_ids: string;
  shipping_option_ids: string;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: number;
  product_id: number;
  label: string;
  price_cents: number;
  stock: number | null;
  sort_order: number;
};

type ImageRow = { id: number; file: string; alt: string; sort_order: number };

type ProductForm = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceFrom: string;
  priceTo: string;
  sku: string;
  weightG: string;
  dimensions: string;
  stock: string;
  sortOrder: string;
  active: boolean;
  shippingMethodIds: string[];
  shippingOptionIds: string[];
};

function orderStatusLabel(status: string): string {
  return orderStatuses.find((item) => item.id === status)?.label ?? status;
}

function quoteStatusLabel(status: string): string {
  return quoteStatuses.find((item) => item.id === status)?.label ?? status;
}

function paymentLabel(id: string): string {
  return paymentMethodLabel(id);
}

function shippingLabel(id: string): string {
  return getPricingConfig({ includeInactive: true }).shipping.methods.find((method) => method.id === id)?.label ?? id;
}

function parseDecimal(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/\s/g, '').replace('€', '').replace(',', '.');
  if (raw === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function euroToCents(value: unknown): number | null {
  const number = parseDecimal(value);
  return number === null ? null : Math.round(number * 100);
}

function intOrNull(value: unknown): number | null {
  const number = parseDecimal(value);
  return number === null ? null : Math.trunc(number);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function queryObject(request: FastifyRequest): Record<string, unknown> {
  return (request.query ?? {}) as Record<string, unknown>;
}

function bodyObject(request: FastifyRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function idList(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [value];
  const ids = values
    .map((entry) => Number(entry))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

/** Liest eine in der Datenbank als JSON gespeicherte ID-Liste. */
function parseIdJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string' && /^[a-z0-9-]+$/.test(entry))
      : [];
  } catch {
    return [];
  }
}

/** Liest Mehrfach-Checkboxen aus einem Formular. */
function bodyIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const ids = values.filter((entry): entry is string => typeof entry === 'string' && /^[a-z0-9-]+$/.test(entry));
  return [...new Set(ids)];
}

function flash(request: FastifyRequest) {
  const query = queryObject(request);
  return {
    gespeichert: query.gespeichert === '1',
    geloescht: query.geloescht === '1',
    zurueckgesetzt: query.zurueckgesetzt === '1',
    importiert: typeof query.importiert === 'string' ? Number.parseInt(query.importiert, 10) || 0 : 0,
    fehler: typeof query.fehler === 'string' ? query.fehler : '',
    antwort: typeof query.antwort === 'string' ? query.antwort : '',
  };
}

function adminContext(request: FastifyRequest, extra: Record<string, unknown> = {}) {
  const session = request.adminSession;
  if (!session) throw new Error('Admin-Sitzung fehlt.');
  return {
    admin: session.user,
    csrf: csrfToken(session),
    meldung: flash(request),
    ...extra,
  };
}

function adminError(request: FastifyRequest, reply: FastifyReply, status: number, message: string) {
  reply.code(status);
  return render(
    reply,
    'admin/fehler.njk',
    adminContext(request, {
      statusCode: status,
      message,
      title: status === 404 ? 'Nicht gefunden' : 'Zugriff verweigert',
    }),
  );
}

function safeNext(value: unknown): string {
  if (typeof value !== 'string') return '/admin/';
  if (!value.startsWith('/admin/') || value.startsWith('//') || value.includes('\\')) return '/admin/';
  if (value.startsWith('/admin/login')) return '/admin/';
  return value;
}

async function adminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const session = getSession(request);
  if (!session) {
    const next = request.url.startsWith('/admin/') ? request.url : '/admin/';
    await reply.redirect(`/admin/login/?weiter=${encodeURIComponent(next)}`, 303);
    return;
  }

  request.admin = session.user;
  request.adminSession = session;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!isSameOrigin(request)) {
      await adminError(request, reply, 403, 'Die Anfrage konnte nicht zugeordnet werden. Bitte laden Sie die Seite neu.');
      return;
    }
    // Bei Multipart-Uploads wird der Body erst in der Route gelesen;
    // dort wird das CSRF-Token aus den Formularfeldern geprüft.
    const contentType = String(request.headers['content-type'] ?? '');
    if (!contentType.startsWith('multipart/form-data') && !verifyCsrf(session, request)) {
      await adminError(request, reply, 403, 'Das Formular ist abgelaufen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.');
      return;
    }
  }
}

function statusMailText(order: OrderRow, status: OrderStatus): string {
  const intro: Record<OrderStatus, string> = {
    neu: 'Ihre Bestellung ist bei uns eingegangen.',
    bezahlt: 'Ihre Zahlung ist bei uns eingegangen. Wir beginnen mit der Fertigung.',
    in_druck: 'Ihre Bestellung befindet sich jetzt im Druck.',
    versandt: 'Ihre Bestellung wurde versandt.',
    abgeschlossen: 'Ihre Bestellung ist abgeschlossen. Vielen Dank für Ihr Vertrauen!',
    storniert: 'Ihre Bestellung wurde storniert.',
  };
  return [
    `Hallo ${order.first_name},`,
    '',
    intro[status],
    '',
    `Bestellnummer: ${order.order_number}`,
    `Neuer Status: ${orderStatusLabel(status)}`,
    '',
    'Den aktuellen Stand Ihrer Bestellung können Sie jederzeit über Ihre Bestellnummer erfragen.',
    '',
    'Viele Grüße',
    '3D-MIR 3D-Druck Service',
  ].join('\n');
}

async function notifyOrderStatus(request: FastifyRequest, order: OrderRow, status: OrderStatus): Promise<void> {
  try {
    await sendMail({
      to: order.email,
      subject: `Bestellung ${order.order_number}: ${orderStatusLabel(status)}`,
      text: statusMailText(order, status),
    });
  } catch (error) {
    request.log.warn({ err: error, order: order.order_number }, 'Status-E-Mail konnte nicht versendet werden');
  }
}

function quoteMailText(quote: QuoteRow, status: QuoteStatus): string {
  return [
    `Hallo ${quote.name},`,
    '',
    `der Status Ihrer Anfrage ${quote.reference} wurde geändert: ${quoteStatusLabel(status)}.`,
    '',
    'Bei Rückfragen antworten Sie einfach auf diese E-Mail.',
    '',
    'Viele Grüße',
    '3D-MIR 3D-Druck Service',
  ].join('\n');
}

async function notifyQuoteStatus(request: FastifyRequest, quote: QuoteRow, status: QuoteStatus): Promise<void> {
  try {
    await sendMail({
      to: quote.email,
      subject: `Anfrage ${quote.reference}: ${quoteStatusLabel(status)}`,
      text: quoteMailText(quote, status),
    });
  } catch (error) {
    request.log.warn({ err: error, quote: quote.reference }, 'Status-E-Mail konnte nicht versendet werden');
  }
}

// ---------------------------------------------------------------------------
// Produkte
// ---------------------------------------------------------------------------

function productShippingChoices() {
  const shipping = getPricingConfig({ includeInactive: true }).shipping;
  return { shippingMethods: shipping.methods, shippingOptions: shipping.options };
}

function emptyProductForm(): ProductForm {
  return {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    priceFrom: '0.00',
    priceTo: '',
    sku: '',
    weightG: '',
    dimensions: '',
    stock: '',
    sortOrder: '0',
    active: true,
    shippingMethodIds: [],
    shippingOptionIds: [],
  };
}

function productFormFromRow(product: ProductRow): ProductForm {
  return {
    name: product.name,
    slug: product.slug,
    shortDescription: product.short_description,
    description: product.description,
    priceFrom: (product.price_from_cents / 100).toFixed(2),
    priceTo: product.price_to_cents === null ? '' : (product.price_to_cents / 100).toFixed(2),
    sku: product.sku ?? '',
    weightG: product.weight_g === null ? '' : String(product.weight_g),
    dimensions: product.dimensions ?? '',
    stock: product.stock === null ? '' : String(product.stock),
    sortOrder: String(product.sort_order),
    active: product.active === 1,
    shippingMethodIds: parseIdJson(product.shipping_method_ids),
    shippingOptionIds: parseIdJson(product.shipping_option_ids),
  };
}

function productCategoryContext(productId?: number) {
  return {
    categoryOptions: allCategories(),
    categoryIds: productId ? categoryIdsForProduct(productId) : [],
  };
}

function readProductForm(body: Record<string, unknown>): ProductForm {
  return {
    name: cleanText(body.name, 200),
    slug: cleanText(body.slug, 120).toLowerCase(),
    shortDescription: cleanText(body.shortDescription, 300),
    description: cleanText(body.description, 10000),
    priceFrom: cleanText(body.priceFrom, 20),
    priceTo: cleanText(body.priceTo, 20),
    sku: cleanText(body.sku, 60),
    weightG: cleanText(body.weightG, 20),
    dimensions: cleanText(body.dimensions, 100),
    stock: cleanText(body.stock, 20),
    sortOrder: cleanText(body.sortOrder, 20) || '0',
    active: body.active === '1' || body.active === 'on',
    shippingMethodIds: bodyIds(body.shippingMethodIds),
    shippingOptionIds: bodyIds(body.shippingOptionIds),
  };
}

type ProductData = {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceFrom: number;
  priceTo: number | null;
  sku: string;
  weightG: number | null;
  dimensions: string;
  stock: number | null;
  sortOrder: number;
  active: boolean;
  shippingMethodIds: string[];
  shippingOptionIds: string[];
};

function validateProductForm(form: ProductForm): { data?: ProductData; error?: string } {
  if (form.name.length < 2) return { error: 'Bitte geben Sie einen Produktnamen mit mindestens 2 Zeichen an.' };
  const slug = form.slug || slugify(form.name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'Der Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.' };
  }
  const priceFrom = euroToCents(form.priceFrom);
  if (priceFrom === null || priceFrom < 0) return { error: 'Bitte geben Sie einen gültigen Preis an.' };
  const priceTo = form.priceTo.trim() === '' ? null : euroToCents(form.priceTo);
  if (priceTo !== null && (priceTo < 0 || priceTo < priceFrom)) {
    return { error: 'Der obere Preis muss mindestens dem unteren Preis entsprechen.' };
  }
  const weightG = form.weightG.trim() === '' ? null : parseDecimal(form.weightG);
  if (weightG !== null && (weightG < 0 || weightG > 1_000_000)) {
    return { error: 'Bitte geben Sie ein gültiges Gewicht an.' };
  }
  const stock = form.stock.trim() === '' ? null : intOrNull(form.stock);
  if (stock !== null && (stock < 0 || stock > 1_000_000)) {
    return { error: 'Bitte geben Sie einen gültigen Lagerbestand an.' };
  }
  const sortOrder = intOrNull(form.sortOrder);
  if (sortOrder === null) return { error: 'Bitte geben Sie eine gültige Sortierung an.' };

  return {
    data: {
      name: form.name,
      slug,
      shortDescription: form.shortDescription,
      description: form.description,
      priceFrom,
      priceTo,
      sku: form.sku,
      weightG,
      dimensions: form.dimensions,
      stock,
      sortOrder,
      active: form.active,
      shippingMethodIds: form.shippingMethodIds,
      shippingOptionIds: form.shippingOptionIds,
    },
  };
}

function productExists(slug: string, exceptId?: number): boolean {
  const row = exceptId
    ? db().prepare('SELECT 1 FROM products WHERE slug = ? AND id <> ?').get(slug, exceptId)
    : db().prepare('SELECT 1 FROM products WHERE slug = ?').get(slug);
  return Boolean(row);
}

function uniqueProductSlug(base: string, exceptId?: number): string {
  const root = (slugify(base) || 'produkt').slice(0, 80);
  let slug = root;
  let counter = 2;
  while (productExists(slug, exceptId)) {
    slug = `${root.slice(0, 75)}-${counter}`;
    counter += 1;
  }
  return slug;
}

function productPriceLabel(product: { min_price: number | null; max_price: number | null; price_from_cents: number; price_to_cents: number | null }): string {
  if (product.min_price !== null) {
    return product.min_price === product.max_price
      ? formatEuro(product.min_price)
      : `${formatEuro(product.min_price)} – ${formatEuro(product.max_price ?? product.min_price)}`;
  }
  return product.price_to_cents === null
    ? formatEuro(product.price_from_cents)
    : `${formatEuro(product.price_from_cents)} – ${formatEuro(product.price_to_cents)}`;
}

function findProduct(id: number): ProductRow | undefined {
  return db().prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
}

function variantsFor(productId: number): VariantRow[] {
  return db()
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id')
    .all(productId) as VariantRow[];
}

function variantFormRows(productId: number) {
  return variantsFor(productId).map((variant) => ({
    ...variant,
    priceValue: (variant.price_cents / 100).toFixed(2),
    stockValue: variant.stock === null ? '' : String(variant.stock),
  }));
}

function imagesFor(productId: number): ImageRow[] {
  return db()
    .prepare('SELECT id, file, alt, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id')
    .all(productId) as ImageRow[];
}

/** Bilder für die Admin-Maske inklusive Vorschau-URL. */
function imageRowsFor(productId: number) {
  return imagesFor(productId).map((image) => ({
    ...image,
    previewUrl: imagePreview(image.file, 400),
    isUpload: image.file.startsWith(UPLOAD_PREFIX),
  }));
}

async function readImageUpload(request: FastifyRequest): Promise<{
  fields: Record<string, string>;
  files: UploadedImage[];
}> {
  const fields: Record<string, string> = {};
  const files: UploadedImage[] = [];
  for await (const part of request.parts({
    limits: {
      files: MAX_PRODUCT_IMAGES,
      fileSize: MAX_PRODUCT_IMAGE_BYTES,
      fields: 10,
    },
  })) {
    if (part.type === 'file') {
      if (part.fieldname !== 'image') {
        part.file.resume();
        continue;
      }
      const buffer = await part.toBuffer();
      files.push({
        buffer,
        filename: path.basename(part.filename || 'bild'),
        mimetype: part.mimetype,
      });
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }
  return { fields, files };
}

class FormError extends Error {}

// ---------------------------------------------------------------------------
// Produkte löschen, kopieren, exportieren und importieren
// ---------------------------------------------------------------------------

function removeProduct(id: number): void {
  for (const image of imagesFor(id)) deleteProductImageFiles(image.file);
  db().prepare('DELETE FROM products WHERE id = ?').run(id);
}

async function duplicateProductImage(sourceFile: string, productId: number): Promise<string | null> {
  if (!sourceFile.startsWith(UPLOAD_PREFIX)) return sourceFile;
  const key = sourceFile.slice(UPLOAD_PREFIX.length);
  const base = mediaFile(key);
  if (!base) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) as {
      variants?: { width?: number }[];
    };
    const widths = (meta.variants ?? [])
      .map((variant) => variant.width)
      .filter((width): width is number => typeof width === 'number');
    if (widths.length === 0) return null;
    const largest = Math.max(...widths);
    const jpg = `${base}-${largest}.jpg`;
    if (!fs.existsSync(jpg)) return null;
    const buffer = fs.readFileSync(jpg);
    return await storeProductImage(productId, { buffer, filename: 'produktbild.jpg', mimetype: 'image/jpeg' });
  } catch {
    return null;
  }
}

type ExportedImage = { alt: string; sortOrder: number; file?: string; data?: string; contentType?: string };

function exportImage(image: ImageRow): ExportedImage | null {
  if (!image.file.startsWith(UPLOAD_PREFIX)) {
    return { alt: image.alt, sortOrder: image.sort_order, file: image.file };
  }
  const key = image.file.slice(UPLOAD_PREFIX.length);
  const base = mediaFile(key);
  if (!base) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) as {
      variants?: { width?: number }[];
    };
    const widths = (meta.variants ?? [])
      .map((variant) => variant.width)
      .filter((width): width is number => typeof width === 'number');
    if (widths.length === 0) return null;
    const largest = Math.max(...widths);
    const jpg = `${base}-${largest}.jpg`;
    if (!fs.existsSync(jpg)) return null;
    return {
      alt: image.alt,
      sortOrder: image.sort_order,
      data: fs.readFileSync(jpg).toString('base64'),
      contentType: 'image/jpeg',
    };
  } catch {
    return null;
  }
}

function exportProducts(ids?: number[]) {
  const all = db().prepare('SELECT * FROM products ORDER BY sort_order, id').all() as ProductRow[];
  const products = ids && ids.length > 0 ? all.filter((product) => ids.includes(product.id)) : all;
  return {
    format: '3d-mir-products',
    version: 1,
    exportedAt: new Date().toISOString(),
    products: products.map((product) => ({
      slug: product.slug,
      name: product.name,
      shortDescription: product.short_description,
      description: product.description,
      priceFromCents: product.price_from_cents,
      priceToCents: product.price_to_cents,
      sku: product.sku ?? '',
      weightG: product.weight_g,
      dimensions: product.dimensions ?? '',
      stock: product.stock,
      active: product.active === 1,
      sortOrder: product.sort_order,
      shippingMethodIds: parseIdJson(product.shipping_method_ids),
      shippingOptionIds: parseIdJson(product.shipping_option_ids),
      variants: variantsFor(product.id).map((variant) => ({
        label: variant.label,
        priceCents: variant.price_cents,
        stock: variant.stock,
        sortOrder: variant.sort_order,
      })),
      images: imagesFor(product.id)
        .map((image) => exportImage(image))
        .filter((image): image is ExportedImage => image !== null),
    })),
  };
}

const importImageSchema = z.object({
  alt: z.string().max(200).optional().default(''),
  sortOrder: z.number().int().optional(),
  file: z.string().max(200).optional(),
  data: z.string().optional(),
  contentType: z.string().max(100).optional(),
});

const importProductSchema = z.object({
  slug: z.string().max(120).optional(),
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(300).optional().default(''),
  description: z.string().max(20000).optional().default(''),
  priceFromCents: z.number().int().min(0).max(100_000_000).optional(),
  priceToCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  sku: z.string().max(60).optional().default(''),
  weightG: z.number().min(0).max(1_000_000).nullable().optional(),
  dimensions: z.string().max(100).optional().default(''),
  stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(-100_000).max(100_000).optional().default(0),
  shippingMethodIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50).optional().default([]),
  shippingOptionIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50).optional().default([]),
  variants: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        priceCents: z.number().int().min(0).max(100_000_000),
        stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
        sortOrder: z.number().int().optional().default(0),
      }),
    )
    .max(100)
    .optional()
    .default([]),
  images: z.array(importImageSchema).max(MAX_PRODUCT_IMAGES).optional().default([]),
});

const importFileSchema = z.object({
  format: z.literal('3d-mir-products'),
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  products: z.array(importProductSchema).min(1).max(200),
});

async function importProducts(data: z.infer<typeof importFileSchema>): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];
  const maxSort = (db().prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM products').get() as { value: number }).value;

  for (const item of data.products) {
    try {
      const slug = uniqueProductSlug(item.slug || item.name);
      const prices = item.variants.map((variant) => variant.priceCents);
      const priceFrom = item.priceFromCents ?? (prices.length > 0 ? Math.min(...prices) : 0);
      const sortOrder = item.sortOrder !== 0 ? item.sortOrder : maxSort + imported + 1;
      const info = db()
        .prepare(
          `INSERT INTO products
             (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g,
              dimensions, stock, active, sort_order, shipping_method_ids, shipping_option_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          slug,
          item.name.slice(0, 200),
          item.shortDescription,
          item.description,
          priceFrom,
          item.priceToCents ?? null,
          item.sku,
          item.weightG ?? null,
          item.dimensions,
          item.stock ?? null,
          item.active ? 1 : 0,
          sortOrder,
          JSON.stringify(item.shippingMethodIds),
          JSON.stringify(item.shippingOptionIds),
        );
      const productId = Number(info.lastInsertRowid);

      const insertVariant = db().prepare(
        'INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)',
      );
      const variantTx = db().transaction(() => {
        item.variants.forEach((variant, index) => {
          insertVariant.run(productId, variant.label, variant.priceCents, variant.stock ?? null, variant.sortOrder || index + 1);
        });
      });
      variantTx();

      let sortOrderImage = 0;
      for (const image of item.images) {
        sortOrderImage += 1;
        try {
          let stored: string | null = null;
          if (image.data) {
            const buffer = Buffer.from(image.data, 'base64');
            if (buffer.length === 0) continue;
            if (buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
              errors.push(`${item.name}: Ein Bild überschreitet 12 MB.`);
              continue;
            }
            const contentType = image.contentType && ALLOWED_IMAGE_TYPES.has(image.contentType)
              ? image.contentType
              : 'image/jpeg';
            stored = await storeProductImage(productId, { buffer, filename: 'import.jpg', mimetype: contentType });
          } else if (image.file && /^[a-z0-9-]+$/.test(image.file) && imagePreview(image.file)) {
            stored = image.file;
          }
          if (!stored) continue;
          db()
            .prepare('INSERT INTO product_images (product_id, file, alt, sort_order) VALUES (?, ?, ?, ?)')
            .run(productId, stored, image.alt || item.name, image.sortOrder || sortOrderImage);
        } catch (error) {
          errors.push(`${item.name}: Bild konnte nicht importiert werden.`);
        }
      }

      imported += 1;
    } catch (error) {
      errors.push(`${item.name}: ${error instanceof Error ? error.message : 'Import fehlgeschlagen.'}`);
    }
  }

  return { imported, errors };
}

async function readImportUpload(request: FastifyRequest): Promise<{
  fields: Record<string, string>;
  file: { buffer: Buffer; filename: string } | null;
}> {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; filename: string } | null = null;
  for await (const part of request.parts({
    limits: { files: 1, fileSize: 20 * 1024 * 1024, fields: 5 },
  })) {
    if (part.type === 'file') {
      if (part.fieldname !== 'file') {
        part.file.resume();
        continue;
      }
      file = { buffer: await part.toBuffer(), filename: path.basename(part.filename || 'produkte.json') };
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }
  return { fields, file };
}

function updateVariants(productId: number, body: Record<string, unknown>): string | null {
  const existing = variantsFor(productId);
  try {
    const run = db().transaction(() => {
      for (const variant of existing) {
        if (body[`variant_${variant.id}_delete`] === '1' || body[`variant_${variant.id}_delete`] === 'on') {
          db().prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?').run(variant.id, productId);
          continue;
        }
        const label = cleanText(body[`variant_${variant.id}_label`], 80);
        const price = euroToCents(body[`variant_${variant.id}_price`]);
        const stock = intOrNull(body[`variant_${variant.id}_stock`]);
        if (!label) throw new FormError('Bitte geben Sie für jede Variante eine Bezeichnung an.');
        if (price === null || price < 0) throw new FormError(`Bitte geben Sie für „${label}“ einen gültigen Preis an.`);
        if (stock !== null && stock < 0) throw new FormError(`Bitte geben Sie für „${label}“ einen gültigen Bestand an.`);
        db()
          .prepare('UPDATE product_variants SET label = ?, price_cents = ?, stock = ? WHERE id = ? AND product_id = ?')
          .run(label, price, stock, variant.id, productId);
      }

      const newLabel = cleanText(body.new_label, 80);
      if (newLabel) {
        const newPrice = euroToCents(body.new_price);
        const newStock = intOrNull(body.new_stock);
        if (newPrice === null || newPrice < 0) throw new FormError('Bitte geben Sie für die neue Variante einen gültigen Preis an.');
        if (newStock !== null && newStock < 0) throw new FormError('Bitte geben Sie für die neue Variante einen gültigen Bestand an.');
        const maxSort = db()
          .prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM product_variants WHERE product_id = ?')
          .get(productId) as { value: number };
        db()
          .prepare('INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)')
          .run(productId, newLabel, newPrice, newStock, maxSort.value + 1);
      }
    });
    run();
    return null;
  } catch (error) {
    if (error instanceof FormError) return error.message;
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: product_variants')) {
      return 'Jede Variante braucht eine eindeutige Bezeichnung. Bitte prüfen Sie die Farbnamen.';
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Preise
// ---------------------------------------------------------------------------

function pricingView(pricing: PricingConfig) {
  return {
    metaValues: {
      minOrder: String(pricing.meta.minOrderValue),
      setup: String(pricing.meta.setupFee),
      setupExtra: String(pricing.meta.setupFeePerExtraPart),
      round: String(pricing.meta.roundTo),
      freeShippingFrom: String(pricing.shipping.freeShippingFrom),
    },
    calculationValues: {
      wall: String(pricing.calculation.wallThicknessMm),
      flow: String(pricing.calculation.materialCm3PerHour),
      waste: String(pricing.calculation.wastePercent),
    },
    materials: pricing.materials.map((material, index) => ({
      ...material,
      index,
      isActive: material.active !== false,
      priceValue: String(material.pricePerGram),
      densityValue: String(material.density),
      maxTempValue: String(material.maxTempC),
      colorsValue: material.colors.join(', '),
    })),
    printers: pricing.printers.map((printer, index) => ({
      ...printer,
      index,
      isActive: printer.active !== false,
      xValue: String(printer.buildVolume.x),
      yValue: String(printer.buildVolume.y),
      zValue: String(printer.buildVolume.z),
      rateValue: String(printer.hourlyRate),
      materialChecks: Object.fromEntries(
        pricing.materials.map((material) => [material.id, printer.materialIds.includes(material.id)]),
      ),
    })),
    coatings: pricing.coatings.map((coating, index) => ({
      ...coating,
      index,
      isActive: coating.active !== false,
      percentValue: String(coating.surchargePercent),
      priceValue: String(coating.pricePerPart),
    })),
    shipping: pricing.shipping.methods.map((method, index) => ({
      ...method,
      index,
      isActive: method.active !== false,
      priceValue: String(method.price),
    })),
    shippingOptions: pricing.shipping.options.map((option, index) => ({
      ...option,
      index,
      isActive: option.active !== false,
      priceValue: String(option.price),
    })),
    discounts: pricing.quantityDiscounts.map((tier, index) => ({
      ...tier,
      index,
      minValue: String(tier.minQuantity),
      percentValue: String(tier.percent),
    })),
    materialOptions: pricing.materials.map((material) => ({ id: material.id, label: material.label })),
  };
}

function uniqueId(label: string, used: Set<string>, fallback: string): string {
  const base = (slugify(label) || fallback).slice(0, 40);
  let candidate = base;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 36)}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function parseColors(value: unknown): string[] {
  const raw = typeof value === 'string' ? value : '';
  const colors = raw
    .split(/[,;\n]/)
    .map((color) => color.trim())
    .filter((color) => color.length > 0)
    .slice(0, 40);
  return colors.length > 0 ? [...new Set(colors)] : ['Schwarz'];
}

/**
 * Ermittelt die Indizes aller Neu-Zeilen einer Kategorie.
 *
 * Das Preis-Formular erlaubt mehrere neue Einträge pro Kategorie. Die Felder
 * heißen `new_<kategorie>_<index>_<feld>`; die Indizes werden aus den
 * Formularschlüsseln gelesen, damit auch ohne JavaScript (nur Index 0) alles
 * funktioniert.
 */
function newRowIndexes(body: Record<string, unknown>, prefix: string): number[] {
  const pattern = new RegExp(`^${prefix}_(\\d+)_`);
  const indexes = new Set<number>();
  for (const key of Object.keys(body)) {
    const match = pattern.exec(key);
    if (match?.[1]) indexes.add(Number(match[1]));
  }
  return [...indexes].sort((a, b) => a - b);
}

function readPricingForm(
  body: Record<string, unknown>,
  pricing: PricingConfig,
): { overrides?: PricingOverrides; error?: string } {
  const numberField = (name: string, min: number, max: number, label: string): number => {
    const value = parseDecimal(body[name]);
    if (value === null || value < min || value > max) {
      throw new FormError(`${label}: Bitte einen Wert zwischen ${min} und ${max} angeben.`);
    }
    return value;
  };
  const value = (name: string, maxLength = 500): string => cleanText(body[name], maxLength);
  const marked = (name: string): boolean => body[name] === '1' || body[name] === 'on';
  const optionalNumber = (name: string, min: number, max: number, label: string, fallback: number): number => {
    const raw = body[name];
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    return numberField(name, min, max, label);
  };

  try {
    const materials: PricingConfig['materials'] = [];
    const usedMaterialIds = new Set<string>();

    pricing.materials.forEach((existing, index) => {
      if (marked(`material_${index}_delete`)) return;
      const label = value(`material_${index}_label`, 80);
      if (!label) throw new FormError('Bitte geben Sie jedem Material eine Bezeichnung.');
      materials.push({
        id: existing.id,
        label,
        density: numberField(`material_${index}_density`, 0.1, 30, `Dichte ${label}`),
        pricePerGram: numberField(`material_${index}_price`, 0, 1000, `Materialpreis ${label}`),
        maxTempC: numberField(`material_${index}_max_temp`, 0, 500, `Temperaturbeständigkeit ${label}`),
        colors: parseColors(body[`material_${index}_colors`]),
        properties: value(`material_${index}_properties`, 300),
        useCases: value(`material_${index}_use_cases`, 300),
        notes: value(`material_${index}_notes`, 500),
        active: marked(`material_${index}_active`),
      });
      usedMaterialIds.add(existing.id);
    });

    for (const index of newRowIndexes(body, 'new_material')) {
      const base = `new_material_${index}`;
      const label = value(`${base}_label`, 80);
      if (!label) continue;
      materials.push({
        id: uniqueId(label, usedMaterialIds, 'material'),
        label,
        density: optionalNumber(`${base}_density`, 0.1, 30, `Dichte ${label}`, 1.24),
        pricePerGram: optionalNumber(`${base}_price`, 0, 1000, `Materialpreis ${label}`, 0.05),
        maxTempC: optionalNumber(`${base}_max_temp`, 0, 500, `Temperaturbeständigkeit ${label}`, 60),
        colors: parseColors(body[`${base}_colors`]),
        properties: value(`${base}_properties`, 300),
        useCases: value(`${base}_use_cases`, 300),
        notes: value(`${base}_notes`, 500),
        active: marked(`${base}_active`),
      });
    }
    if (materials.length === 0) throw new FormError('Mindestens ein Material muss vorhanden sein.');
    if (!materials.some((material) => material.active)) {
      throw new FormError('Mindestens ein Material muss aktiv sein, sonst steht der Rechner nicht zur Verfügung.');
    }

    const materialIds = materials.map((material) => material.id);

    const printers: PricingConfig['printers'] = [];
    const usedPrinterIds = new Set<string>();
    pricing.printers.forEach((existing, index) => {
      if (marked(`printer_${index}_delete`)) return;
      const label = value(`printer_${index}_label`, 80);
      if (!label) throw new FormError('Bitte geben Sie jedem Drucker eine Bezeichnung.');
      const selected = materialIds.filter((materialId) => marked(`printer_${index}_material_${materialId}`));
      printers.push({
        id: existing.id,
        label,
        buildVolume: {
          x: numberField(`printer_${index}_x`, 10, 2000, `Bauraum X ${label}`),
          y: numberField(`printer_${index}_y`, 10, 2000, `Bauraum Y ${label}`),
          z: numberField(`printer_${index}_z`, 10, 2000, `Bauraum Z ${label}`),
        },
        hourlyRate: numberField(`printer_${index}_rate`, 0, 1000, `Maschinenstunde ${label}`),
        materialIds: selected.length > 0 ? selected : materialIds,
        note: value(`printer_${index}_note`, 500),
        active: marked(`printer_${index}_active`),
      });
      usedPrinterIds.add(existing.id);
    });

    for (const index of newRowIndexes(body, 'new_printer')) {
      const base = `new_printer_${index}`;
      const label = value(`${base}_label`, 80);
      if (!label) continue;
      const selected = materialIds.filter((materialId) => marked(`${base}_material_${materialId}`));
      printers.push({
        id: uniqueId(label, usedPrinterIds, 'drucker'),
        label,
        buildVolume: {
          x: optionalNumber(`${base}_x`, 10, 2000, `Bauraum X ${label}`, 220),
          y: optionalNumber(`${base}_y`, 10, 2000, `Bauraum Y ${label}`, 220),
          z: optionalNumber(`${base}_z`, 10, 2000, `Bauraum Z ${label}`, 250),
        },
        hourlyRate: optionalNumber(`${base}_rate`, 0, 1000, `Maschinenstunde ${label}`, 1),
        materialIds: selected.length > 0 ? selected : materialIds,
        note: value(`${base}_note`, 500),
        active: marked(`${base}_active`),
      });
    }
    if (printers.length === 0) throw new FormError('Mindestens ein Drucker muss vorhanden sein.');
    if (!printers.some((printer) => printer.active)) {
      throw new FormError('Mindestens ein Drucker muss aktiv sein, sonst steht der Rechner nicht zur Verfügung.');
    }

    const coatings: PricingConfig['coatings'] = [];
    const usedCoatingIds = new Set<string>();
    pricing.coatings.forEach((existing, index) => {
      if (marked(`coating_${index}_delete`)) return;
      const label = value(`coating_${index}_label`, 80);
      if (!label) throw new FormError('Bitte geben Sie jeder Nachbearbeitung eine Bezeichnung.');
      coatings.push({
        id: existing.id,
        label,
        surchargePercent: numberField(`coating_${index}_percent`, 0, 100, `Zuschlag ${label}`),
        pricePerPart: numberField(`coating_${index}_price`, 0, 10000, `Preis ${label}`),
        active: marked(`coating_${index}_active`),
      });
      usedCoatingIds.add(existing.id);
    });
    for (const index of newRowIndexes(body, 'new_coating')) {
      const base = `new_coating_${index}`;
      const label = value(`${base}_label`, 80);
      if (!label) continue;
      coatings.push({
        id: uniqueId(label, usedCoatingIds, 'nachbearbeitung'),
        label,
        surchargePercent: optionalNumber(`${base}_percent`, 0, 100, `Zuschlag ${label}`, 0),
        pricePerPart: optionalNumber(`${base}_price`, 0, 10000, `Preis ${label}`, 0),
        active: marked(`${base}_active`),
      });
    }
    if (coatings.length === 0) throw new FormError('Mindestens eine Nachbearbeitungsoption muss vorhanden sein.');
    if (!coatings.some((coating) => coating.active)) {
      throw new FormError('Mindestens eine Nachbearbeitung muss aktiv sein.');
    }

    const shippingMethods: PricingConfig['shipping']['methods'] = [];
    const usedShippingIds = new Set<string>();
    pricing.shipping.methods.forEach((existing, index) => {
      if (marked(`shipping_${index}_delete`)) return;
      const label = value(`shipping_${index}_label`, 80);
      if (!label) throw new FormError('Bitte geben Sie jeder Versandart eine Bezeichnung.');
      shippingMethods.push({
        id: existing.id,
        label,
        price: numberField(`shipping_${index}_price`, 0, 1000, `Versandkosten ${label}`),
        deliveryDays: value(`shipping_${index}_days`, 80),
        active: marked(`shipping_${index}_active`),
      });
      usedShippingIds.add(existing.id);
    });
    for (const index of newRowIndexes(body, 'new_shipping')) {
      const base = `new_shipping_${index}`;
      const label = value(`${base}_label`, 80);
      if (!label) continue;
      shippingMethods.push({
        id: uniqueId(label, usedShippingIds, 'versand'),
        label,
        price: optionalNumber(`${base}_price`, 0, 1000, `Preis ${label}`, 0),
        deliveryDays: value(`${base}_days`, 80),
        active: marked(`${base}_active`),
      });
    }
    if (shippingMethods.length === 0) throw new FormError('Mindestens eine Versandart muss vorhanden sein.');
    if (!shippingMethods.some((method) => method.active)) {
      throw new FormError('Mindestens eine Versandart muss aktiv sein.');
    }

    const shippingOptions: PricingConfig['shipping']['options'] = [];
    const usedShippingOptionIds = new Set<string>();
    pricing.shipping.options.forEach((existing, index) => {
      if (marked(`shipping_option_${index}_delete`)) return;
      const label = value(`shipping_option_${index}_label`, 80);
      if (!label) throw new FormError('Bitte geben Sie jeder Versandoption eine Bezeichnung.');
      shippingOptions.push({
        id: existing.id,
        label,
        price: numberField(`shipping_option_${index}_price`, 0, 1000, `Preis ${label}`),
        note: value(`shipping_option_${index}_note`, 200),
        active: marked(`shipping_option_${index}_active`),
      });
      usedShippingOptionIds.add(existing.id);
    });
    for (const index of newRowIndexes(body, 'new_shipping_option')) {
      const base = `new_shipping_option_${index}`;
      const label = value(`${base}_label`, 80);
      if (!label) continue;
      shippingOptions.push({
        id: uniqueId(label, usedShippingOptionIds, 'versandoption'),
        label,
        price: optionalNumber(`${base}_price`, 0, 1000, `Preis ${label}`, 0),
        note: value(`${base}_note`, 200),
        active: marked(`${base}_active`),
      });
    }

    const quantityDiscounts: PricingConfig['quantityDiscounts'] = [];
    const seenQuantities = new Set<number>();
    pricing.quantityDiscounts.forEach((_tier, index) => {
      if (marked(`discount_${index}_delete`)) return;
      const minQuantity = Math.round(numberField(`discount_${index}_min`, 1, 100000, 'Mengenrabatt: Stückzahl'));
      if (seenQuantities.has(minQuantity)) {
        throw new FormError(`Die Stückzahl ${minQuantity} ist beim Mengenrabatt doppelt vorhanden.`);
      }
      seenQuantities.add(minQuantity);
      quantityDiscounts.push({
        minQuantity,
        percent: numberField(`discount_${index}_percent`, 0, 100, `Rabatt ab ${minQuantity} Stück`),
      });
    });
    for (const index of newRowIndexes(body, 'new_discount')) {
      const base = `new_discount_${index}`;
      const rawMin = body[`${base}_min`];
      if (typeof rawMin !== 'string' || rawMin.trim() === '') continue;
      const minQuantity = Math.round(numberField(`${base}_min`, 1, 100000, 'Mengenrabatt: Stückzahl'));
      if (seenQuantities.has(minQuantity)) {
        throw new FormError(`Die Stückzahl ${minQuantity} ist beim Mengenrabatt doppelt vorhanden.`);
      }
      seenQuantities.add(minQuantity);
      quantityDiscounts.push({
        minQuantity,
        percent: optionalNumber(`${base}_percent`, 0, 100, `Rabatt ab ${minQuantity} Stück`, 0),
      });
    }
    quantityDiscounts.sort((a, b) => a.minQuantity - b.minQuantity);

    const overrides: PricingOverrides = {
      meta: {
        minOrderValue: numberField('meta_min_order', 0, 100000, 'Mindestauftragswert'),
        setupFee: numberField('meta_setup', 0, 10000, 'Rüstkosten'),
        setupFeePerExtraPart: numberField('meta_setup_extra', 0, 10000, 'Rüstkosten je weiteres Teil'),
        roundTo: numberField('meta_round', 0.01, 100, 'Rundung'),
      },
      calculation: {
        wallThicknessMm: numberField('calc_wall', 0.1, 10, 'Wandstärke'),
        materialCm3PerHour: numberField('calc_flow', 0.1, 1000, 'Materialdurchsatz'),
        wastePercent: numberField('calc_waste', 0, 100, 'Verschnitt'),
      },
      shipping: {
        freeShippingFrom: numberField('shipping_free_from', 0, 100000, 'Kostenloser Versand ab'),
      },
      catalog: {
        materials,
        printers,
        coatings,
        shippingMethods,
        shippingOptions,
        quantityDiscounts,
      },
    };

    return { overrides };
  } catch (error) {
    if (error instanceof FormError) return { error: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin', async (_request, reply) => reply.redirect('/admin/', 301));

  app.get('/admin/login/', async (request, reply) => {
    if (getSession(request)) return reply.redirect('/admin/', 303);
    const query = queryObject(request);
    render(reply, 'admin/login.njk', {
      email: typeof query.email === 'string' ? query.email : '',
      weiter: safeNext(query.weiter),
      abgemeldet: query.abgemeldet === '1',
    });
  });

  app.post(
    '/admin/login/',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!isSameOrigin(request)) {
        reply.code(403);
        return render(reply, 'admin/login.njk', {
          email: '',
          weiter: '/admin/',
          error: 'Die Anfrage konnte nicht zugeordnet werden.',
        });
      }

      const body = bodyObject(request);
      const email = cleanText(body.email, 200).toLowerCase();
      const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
      const weiter = safeNext(body.weiter);

      const user = db()
        .prepare("SELECT id, email, name, password_hash, role FROM users WHERE email = ?")
        .get(email) as { id: number; email: string; name: string; password_hash: string; role: string } | undefined;

      const ok = Boolean(user && user.role === 'admin' && (await verifyPassword(user.password_hash, password)));
      if (!ok || !user) {
        writeAudit(email || 'unbekannt', 'admin.login.failed', { ip: request.ip });
        request.log.warn({ email, ip: request.ip }, 'Admin-Anmeldung fehlgeschlagen');
        reply.code(401);
        return render(reply, 'admin/login.njk', {
          email,
          weiter,
          error: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        });
      }

      const session = createSession(user.id);
      setSessionCookie(reply, request, session.id);
      writeAudit(user.email, 'admin.login', { ip: request.ip });
      request.log.info({ email: user.email, ip: request.ip }, 'Admin angemeldet');
      return reply.redirect(weiter, 303);
    },
  );

  app.register(async (scope) => {
    scope.addHook('preHandler', adminGuard);

    scope.post('/admin/logout/', async (request, reply) => {
      const session = request.adminSession;
      if (session) {
        writeAudit(session.user.email, 'admin.logout', { ip: request.ip });
        destroySession(session);
      }
      clearSessionCookie(reply);
      return reply.redirect('/admin/login/?abgemeldet=1', 303);
    });

    // Dashboard ------------------------------------------------------------
    scope.get('/admin/', async (request, reply) => {
      const orderCounts = db()
        .prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status')
        .all() as { status: string; count: number }[];
      const counts = Object.fromEntries(orderCounts.map((row) => [row.status, row.count]));
      const openOrders = orderCounts
        .filter((row) => ['neu', 'bezahlt', 'in_druck'].includes(row.status))
        .reduce((sum, row) => sum + row.count, 0);
      const newQuotes = (db().prepare("SELECT COUNT(*) AS count FROM quote_requests WHERE status = 'neu'").get() as { count: number }).count;
      const openMessages = (db().prepare('SELECT COUNT(*) AS count FROM contact_messages WHERE handled = 0').get() as { count: number }).count;
      const openPayments = (
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM orders WHERE payment_status IN ('offen', 'in_bearbeitung') AND status <> 'storniert'",
          )
          .get() as { count: number }
      ).count;
      const revenue = (
        db()
          .prepare(
            "SELECT COALESCE(SUM(total_cents), 0) AS cents FROM orders WHERE status IN ('bezahlt', 'in_druck', 'versandt', 'abgeschlossen')",
          )
          .get() as { cents: number }
      ).cents;
      const recentOrders = (
        db()
          .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 6')
          .all() as OrderRow[]
      ).map((order) => ({
        ...order,
        paymentStatusText: paymentStatusLabel(order.payment_status),
        paymentStatusTone: paymentStatusTone(order.payment_status),
      }));

      render(
        reply,
        'admin/dashboard.njk',
        adminContext(request, {
          counts,
          openOrders,
          newQuotes,
          openMessages,
          openPayments,
          revenue,
          recentOrders,
          recentQuotes: db()
            .prepare('SELECT * FROM quote_requests ORDER BY created_at DESC, id DESC LIMIT 6')
            .all() as QuoteRow[],
          recentMessages: db()
            .prepare('SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT 6')
            .all() as ContactRow[],
        }),
      );
    });

    // Bestellungen --------------------------------------------------------
    scope.get('/admin/bestellungen/', async (request, reply) => {
      const query = queryObject(request);
      const status = orderStatuses.some((item) => item.id === query.status) ? String(query.status) : '';
      const paymentStatus = paymentStatuses.some((item) => item.id === query.paymentStatus)
        ? String(query.paymentStatus)
        : '';
      const q = cleanText(query.q, 100);
      const where: string[] = [];
      const params: unknown[] = [];
      if (status) {
        where.push('status = ?');
        params.push(status);
      }
      if (paymentStatus) {
        where.push('payment_status = ?');
        params.push(paymentStatus);
      }
      if (q) {
        where.push('(order_number LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      const orders = (
        db()
          .prepare(`SELECT * FROM orders ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT 200`)
          .all(...params) as OrderRow[]
      ).map((order) => ({
        ...order,
        paymentStatusText: paymentStatusLabel(order.payment_status),
        paymentStatusTone: paymentStatusTone(order.payment_status),
      }));
      render(
        reply,
        'admin/orders.njk',
        adminContext(request, {
          orders,
          statuses: orderStatuses,
          paymentStatuses,
          status,
          paymentStatus,
          q,
        }),
      );
    });

    scope.get<{ Params: { id: string } }>('/admin/bestellungen/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const order = Number.isInteger(id) ? (db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined) : undefined;
      if (!order) return adminError(request, reply, 404, 'Diese Bestellung wurde nicht gefunden.');
      const items = db().prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id) as OrderItemRow[];
      const selectedOptions = db()
        .prepare('SELECT label, price_cents FROM order_options WHERE order_id = ? ORDER BY id')
        .all(id) as { label: string; price_cents: number }[];
      const history = db()
        .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC')
        .all(id) as { from_status: string; to_status: string; actor: string; note: string; created_at: string }[];
      render(
        reply,
        'admin/order.njk',
        adminContext(request, {
          order,
          items,
          options: selectedOptions,
          history,
          statuses: orderStatuses,
          paymentStatuses,
          paymentLabel: paymentLabel(order.payment_method),
          paymentStatusText: paymentStatusLabel(order.payment_status),
          paymentStatusTone: paymentStatusTone(order.payment_status),
          paymentProviderText: paymentProviderLabel(order.payment_provider),
          shippingLabel: shippingLabel(order.shipping_method),
        }),
      );
    });

    scope.post<{ Params: { id: string } }>('/admin/bestellungen/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const order = Number.isInteger(id) ? (db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined) : undefined;
      if (!order) return adminError(request, reply, 404, 'Diese Bestellung wurde nicht gefunden.');

      const body = bodyObject(request);
      const status = orderStatuses.find((item) => item.id === body.status)?.id;
      if (!status) {
        return reply.redirect(`/admin/bestellungen/${id}/?fehler=status`, 303);
      }
      const adminNote = cleanText(body.adminNote, 2000);
      const notify = body.notify === '1' || body.notify === 'on';
      const paidNow = status === 'bezahlt' && order.payment_status !== 'bezahlt';

      if (paidNow) {
        db()
          .prepare("UPDATE orders SET admin_note = ?, updated_at = datetime('now') WHERE id = ?")
          .run(adminNote, id);
        const paid = markOrderPaid(id, order.payment_provider || 'manual', order.payment_reference || order.order_number);
        if (paid.changed && paid.order) await sendPaymentConfirmed(paid.order);
      } else {
        const run = db().transaction(() => {
          db()
            .prepare("UPDATE orders SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?")
            .run(status, adminNote, id);
          if (status !== order.status) {
            db()
              .prepare('INSERT INTO order_status_history (order_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)')
              .run(id, order.status, status, request.admin?.email ?? '', adminNote);
          }
        });
        run();
      }

      if (status === 'storniert' && order.status !== 'storniert') {
        releaseStock(id, 'Bestellung im Admin storniert', false);
      }
      writeAudit(request.admin?.email ?? 'admin', 'order.update', { order: order.order_number, from: order.status, to: status });

      if (notify && status !== order.status && !paidNow) {
        await notifyOrderStatus(request, { ...order, status }, status);
      }
      return reply.redirect(`/admin/bestellungen/${id}/?gespeichert=1`, 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/bestellungen/:id/zahlung/', async (request, reply) => {
      const id = Number(request.params.id);
      const order = Number.isInteger(id) ? (db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined) : undefined;
      if (!order) return adminError(request, reply, 404, 'Diese Bestellung wurde nicht gefunden.');

      const action = cleanText(bodyObject(request).action, 20);
      if (action === 'paid') {
        const paid = markOrderPaid(
          id,
          order.payment_provider || 'manual',
          order.payment_reference || order.order_number,
        );
        if (paid.changed && paid.order) await sendPaymentConfirmed(paid.order);
        writeAudit(request.admin?.email ?? 'admin', 'order.payment.paid', { order: order.order_number });
      } else if (action === 'refunded') {
        if (order.payment_status !== 'bezahlt') {
          return reply.redirect(`/admin/bestellungen/${id}/?fehler=payment`, 303);
        }
        markOrderRefunded(id, 'Erstattung im Admin vermerkt.', request.admin?.email ?? 'admin');
        writeAudit(request.admin?.email ?? 'admin', 'order.payment.refunded', { order: order.order_number });
      } else if (action === 'failed') {
        if (order.payment_status === 'bezahlt') {
          return reply.redirect(`/admin/bestellungen/${id}/?fehler=payment`, 303);
        }
        markOrderPaymentFailed(
          id,
          order.payment_provider || 'manual',
          order.payment_reference,
          'Vom Betreiber als fehlgeschlagen markiert.',
        );
        writeAudit(request.admin?.email ?? 'admin', 'order.payment.failed', { order: order.order_number });
      } else {
        return reply.redirect(`/admin/bestellungen/${id}/?fehler=payment`, 303);
      }

      return reply.redirect(`/admin/bestellungen/${id}/?gespeichert=1`, 303);
    });

    // Anfragen ------------------------------------------------------------
    scope.get('/admin/anfragen/', async (request, reply) => {
      const query = queryObject(request);
      const status = quoteStatuses.some((item) => item.id === query.status) ? String(query.status) : '';
      const q = cleanText(query.q, 100);
      const where: string[] = [];
      const params: unknown[] = [];
      if (status) {
        where.push('status = ?');
        params.push(status);
      }
      if (q) {
        where.push('(reference LIKE ? OR email LIKE ? OR name LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      const quotes = db()
        .prepare(`SELECT * FROM quote_requests ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT 200`)
        .all(...params) as QuoteRow[];
      render(reply, 'admin/quotes.njk', adminContext(request, { quotes, statuses: quoteStatuses, status, q }));
    });

    scope.get<{ Params: { id: string } }>('/admin/anfragen/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const quote = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as QuoteRow | undefined)
        : undefined;
      if (!quote) return adminError(request, reply, 404, 'Diese Anfrage wurde nicht gefunden.');
      const pricing = getPricingConfig({ includeInactive: true });
      const material = pricing.materials.find((item) => item.id === quote.material_id);
      const printer = pricing.printers.find((item) => item.id === quote.printer_id);
      const coating = pricing.coatings.find((item) => item.id === quote.coating);
      const history = db()
        .prepare('SELECT * FROM quote_status_history WHERE quote_id = ? ORDER BY created_at DESC, id DESC')
        .all(id) as { from_status: string; to_status: string; actor: string; note: string; created_at: string }[];
      render(
        reply,
        'admin/quote.njk',
        adminContext(request, {
          quote,
          statuses: quoteStatuses,
          materialLabel: material?.label ?? quote.material_id,
          printerLabel: printer?.label ?? quote.printer_id,
          coatingLabel: coating?.label ?? quote.coating,
          history,
        }),
      );
    });

    scope.post<{ Params: { id: string } }>('/admin/anfragen/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const quote = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as QuoteRow | undefined)
        : undefined;
      if (!quote) return adminError(request, reply, 404, 'Diese Anfrage wurde nicht gefunden.');

      const body = bodyObject(request);
      const status = quoteStatuses.find((item) => item.id === body.status)?.id;
      if (!status) return reply.redirect(`/admin/anfragen/${id}/?fehler=status`, 303);
      const adminNote = cleanText(body.adminNote, 2000);
      const notify = body.notify === '1' || body.notify === 'on';

      const run = db().transaction(() => {
        db()
          .prepare("UPDATE quote_requests SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?")
          .run(status, adminNote, id);
        if (status !== quote.status) {
          db()
            .prepare('INSERT INTO quote_status_history (quote_id, from_status, to_status, actor, note) VALUES (?, ?, ?, ?, ?)')
            .run(id, quote.status, status, request.admin?.email ?? '', adminNote);
        }
      });
      run();
      writeAudit(request.admin?.email ?? 'admin', 'quote.update', { quote: quote.reference, from: quote.status, to: status });

      if (notify && status !== quote.status) {
        await notifyQuoteStatus(request, { ...quote, status }, status);
      }
      return reply.redirect(`/admin/anfragen/${id}/?gespeichert=1`, 303);
    });

    scope.get<{ Params: { id: string } }>('/admin/anfragen/:id/datei/', async (request, reply) => {
      const id = Number(request.params.id);
      const quote = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as QuoteRow | undefined)
        : undefined;
      if (!quote || !quote.file_path) return adminError(request, reply, 404, 'Für diese Anfrage ist keine Datei gespeichert.');

      const uploadRoot = path.resolve(config.uploadDir);
      const file = path.resolve(uploadRoot, quote.file_path);
      if (!file.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(file)) {
        return adminError(request, reply, 404, 'Die Datei wurde nicht gefunden.');
      }
      const name = (quote.file_name ?? path.basename(file)).replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'modell';
      writeAudit(request.admin?.email ?? 'admin', 'quote.download', { quote: quote.reference, file: quote.file_path });
      return reply
        .type('application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${name}"`)
        .send(fs.createReadStream(file));
    });

    scope.get<{ Params: { id: string } }>('/admin/anfragen/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const quote = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as QuoteRow | undefined)
        : undefined;
      if (!quote) return adminError(request, reply, 404, 'Diese Anfrage wurde nicht gefunden.');
      render(reply, 'admin/confirm.njk', adminContext(request, {
        title: 'Anfrage löschen',
        message: `Soll die Anfrage ${quote.reference} mit allen Angaben und der hochgeladenen Datei endgültig gelöscht werden?`,
        action: `/admin/anfragen/${id}/loeschen/`,
        cancel: `/admin/anfragen/${id}/`,
      }));
    });

    scope.post<{ Params: { id: string } }>('/admin/anfragen/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const quote = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM quote_requests WHERE id = ?').get(id) as QuoteRow | undefined)
        : undefined;
      if (!quote) return adminError(request, reply, 404, 'Diese Anfrage wurde nicht gefunden.');

      if (quote.file_path) {
        const uploadRoot = path.resolve(config.uploadDir);
        const file = path.resolve(uploadRoot, quote.file_path);
        if (file.startsWith(`${uploadRoot}${path.sep}`) && fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch (error) {
            request.log.warn({ err: error, file }, 'Anfrage-Datei konnte nicht gelöscht werden');
          }
        }
      }
      db().prepare('DELETE FROM quote_requests WHERE id = ?').run(id);
      writeAudit(request.admin?.email ?? 'admin', 'quote.delete', { quote: quote.reference, email: quote.email });
      return reply.redirect('/admin/anfragen/?geloescht=1', 303);
    });

    // Kontaktnachrichten --------------------------------------------------
    const contactMessage = (id: number): ContactRow | undefined =>
      Number.isInteger(id)
        ? (db().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as ContactRow | undefined)
        : undefined;

    scope.get('/admin/nachrichten/', async (request, reply) => {
      const messages = db()
        .prepare(
          `SELECT * FROM contact_messages
           ORDER BY CASE review_status WHEN 'pruefen' THEN 0 WHEN 'ok' THEN 1 ELSE 2 END,
                    handled ASC, created_at DESC, id DESC
           LIMIT 300`,
        )
        .all() as ContactRow[];
      const reviewCount = messages.filter((message) => message.review_status === 'pruefen').length;
      const spamCount = messages.filter((message) => message.review_status === 'spam').length;
      render(reply, 'admin/messages.njk', adminContext(request, {
        messages,
        contactSettings: getContactSettings(),
        countries,
        countryLabels: Object.fromEntries(countries.map((country) => [country.code, country.name])),
        geoip: geoipStatus(),
        reviewCount,
        spamCount,
      }));
    });

    scope.post('/admin/nachrichten/einstellungen/', async (request, reply) => {
      const body = bodyObject(request);
      const rawCountries = body.allowedCountries;
      const allowedCountries = [
        ...new Set(
          (Array.isArray(rawCountries) ? rawCountries : typeof rawCountries === 'string' ? [rawCountries] : [])
            .map((entry) => String(entry).trim().toUpperCase())
            .filter(isKnownCountry),
        ),
      ];
      const countryCheck = body.countryCheck === '1' || body.countryCheck === 'on';
      if (countryCheck && allowedCountries.length === 0) {
        return reply.redirect(
          `/admin/nachrichten/?fehler=${encodeURIComponent('Bitte mindestens ein erlaubtes Land auswählen.')}`,
          303,
        );
      }
      const mode: ContactReviewMode = body.mode === 'block' ? 'block' : 'review';
      const unknownCountry: UnknownCountryBehavior =
        body.unknownCountry === 'block' || body.unknownCountry === 'allow'
          ? body.unknownCountry
          : 'review';
      const settings: ContactSettings = {
        countryCheck,
        allowedCountries,
        mode,
        unknownCountry,
        timeCheck: body.timeCheck === '1' || body.timeCheck === 'on',
        contentCheck: body.contentCheck === '1' || body.contentCheck === 'on',
      };
      saveContactSettings(settings);
      writeAudit(request.admin?.email ?? 'admin', 'contact.settings', {
        countryCheck,
        allowedCountries,
        mode,
        unknownCountry,
      });
      return reply.redirect('/admin/nachrichten/?gespeichert=1', 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/antworten/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');

      const body = bodyObject(request);
      const subject = cleanText(body.replySubject, 200) || `Re: ${message.subject || 'Ihre Anfrage'}`;
      const text = cleanText(body.replyText, 10000);
      if (text.length < 2) {
        return reply.redirect(
          `/admin/nachrichten/?fehler=${encodeURIComponent('Bitte geben Sie eine Antwort ein.')}#nachricht-${id}`,
          303,
        );
      }

      try {
        const result = await sendMail({
          to: message.email,
          subject,
          text: [`Hallo ${message.name},`, '', text, '', 'Viele Grüße', '3D-MIR 3D-Druck Service'].join('\n'),
          replyTo: config.site.business.email,
        });
        db()
          .prepare(
            `UPDATE contact_messages
             SET replied_at = datetime('now'), reply_subject = ?, reply_text = ?, handled = 1
             WHERE id = ?`,
          )
          .run(subject, text, id);
        writeAudit(request.admin?.email ?? 'admin', 'contact.reply', {
          id,
          email: message.email,
          delivered: result.delivered,
        });
        return reply.redirect(
          `/admin/nachrichten/?gespeichert=1&antwort=${result.delivered ? 'gesendet' : 'datei'}#nachricht-${id}`,
          303,
        );
      } catch (error) {
        request.log.error({ err: error, id }, 'Antwort auf Kontaktnachricht fehlgeschlagen');
        const detail = error instanceof Error ? error.message : 'Unbekannter Fehler';
        return reply.redirect(
          `/admin/nachrichten/?fehler=${encodeURIComponent(`Antwort konnte nicht gesendet werden: ${detail}`)}#nachricht-${id}`,
          303,
        );
      }
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/freigeben/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');

      try {
        await notifyAdmin({
          subject: `[Kontakt] ${message.subject || 'Kontaktnachricht'} – ${message.name}`,
          text: contactMailText(message),
          html: contactMailHtml(message),
          replyTo: message.email,
        });
      } catch (error) {
        request.log.error({ err: error, id }, 'Freigabe der Kontaktnachricht: Benachrichtigung fehlgeschlagen');
      }

      db()
        .prepare("UPDATE contact_messages SET review_status = 'ok', review_reason = '', handled = 0 WHERE id = ?")
        .run(id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.approve', { id, email: message.email });
      return reply.redirect(`/admin/nachrichten/?gespeichert=1#nachricht-${id}`, 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/spam/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      db()
        .prepare("UPDATE contact_messages SET review_status = 'spam', handled = 1 WHERE id = ?")
        .run(id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.spam', { id, email: message.email });
      return reply.redirect(`/admin/nachrichten/?gespeichert=1#nachricht-${id}`, 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      const handled = bodyObject(request).handled === '1' || bodyObject(request).handled === 'on';
      db().prepare('UPDATE contact_messages SET handled = ? WHERE id = ?').run(handled ? 1 : 0, id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.update', { id, handled });
      return reply.redirect('/admin/nachrichten/?gespeichert=1', 303);
    });

    scope.get<{ Params: { id: string } }>('/admin/nachrichten/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      render(reply, 'admin/confirm.njk', adminContext(request, {
        title: 'Nachricht löschen',
        message: `Soll die Nachricht von ${message.name} vom ${message.created_at} endgültig gelöscht werden?`,
        action: `/admin/nachrichten/${id}/loeschen/`,
        cancel: '/admin/nachrichten/',
      }));
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = contactMessage(id);
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      db().prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.delete', { id, email: message.email });
      return reply.redirect('/admin/nachrichten/?geloescht=1', 303);
    });

    // Kategorien ----------------------------------------------------------
    scope.get('/admin/kategorien/', async (request, reply) => {
      const counts = db()
        .prepare('SELECT category_id, COUNT(*) AS count FROM product_category_links GROUP BY category_id')
        .all() as { category_id: number; count: number }[];
      const countMap = new Map(counts.map((row) => [row.category_id, row.count]));
      render(reply, 'admin/categories.njk', adminContext(request, {
        categories: allCategories().map((category) => ({
          ...category,
          productCount: countMap.get(category.id) ?? 0,
        })),
      }));
    });

    scope.post('/admin/kategorien/', async (request, reply) => {
      const body = bodyObject(request);
      const result = createCategory(cleanText(body.name, 80), intOrNull(body.sortOrder) ?? 0);
      if (result.error) {
        return reply.redirect(`/admin/kategorien/?fehler=${encodeURIComponent(result.error)}`, 303);
      }
      writeAudit(request.admin?.email ?? 'admin', 'category.create', { id: result.category?.id, name: result.category?.name });
      return reply.redirect('/admin/kategorien/?gespeichert=1', 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/kategorien/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id)) return adminError(request, reply, 404, 'Diese Kategorie wurde nicht gefunden.');
      const body = bodyObject(request);
      const result = updateCategory(id, cleanText(body.name, 80), intOrNull(body.sortOrder) ?? 0);
      if (result.error) {
        return reply.redirect(`/admin/kategorien/?fehler=${encodeURIComponent(result.error)}`, 303);
      }
      writeAudit(request.admin?.email ?? 'admin', 'category.update', { id });
      return reply.redirect('/admin/kategorien/?gespeichert=1', 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/kategorien/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id)) return adminError(request, reply, 404, 'Diese Kategorie wurde nicht gefunden.');
      const result = deleteCategory(id);
      if (result.error) {
        return reply.redirect(`/admin/kategorien/?fehler=${encodeURIComponent(result.error)}`, 303);
      }
      writeAudit(request.admin?.email ?? 'admin', 'category.delete', { id });
      return reply.redirect('/admin/kategorien/?geloescht=1', 303);
    });

    // Produkte ------------------------------------------------------------
    scope.get('/admin/produkte/', async (request, reply) => {
      const products = (
        db()
          .prepare(
            `SELECT p.*,
               (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
               (SELECT MIN(v.price_cents) FROM product_variants v WHERE v.product_id = p.id) AS min_price,
               (SELECT MAX(v.price_cents) FROM product_variants v WHERE v.product_id = p.id) AS max_price
             FROM products p ORDER BY p.sort_order, p.name`,
          )
          .all() as (ProductRow & { variant_count: number; min_price: number | null; max_price: number | null })[]
      ).map((product) => ({
        ...product,
        priceLabel: productPriceLabel(product),
        stockLabel: product.stock === null ? 'ohne Bestandsführung' : String(product.stock),
        stockEmpty: product.stock === null,
      }));
      render(reply, 'admin/products.njk', adminContext(request, { products }));
    });

    // Export / Import -----------------------------------------------------
    scope.get('/admin/produkte/export/', async (_request, reply) => {
      const stamp = new Date().toISOString().slice(0, 10);
      return reply
        .type('application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="3d-mir-produkte-${stamp}.json"`)
        .send(JSON.stringify(exportProducts(), null, 2));
    });

    scope.get<{ Params: { id: string } }>('/admin/produkte/:id/export/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');
      const stamp = new Date().toISOString().slice(0, 10);
      return reply
        .type('application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="3d-mir-${product.slug}-${stamp}.json"`)
        .send(JSON.stringify(exportProducts([id]), null, 2));
    });

    scope.get('/admin/produkte/import/', async (request, reply) => {
      render(reply, 'admin/import.njk', adminContext(request, {}));
    });

    scope.post('/admin/produkte/import/', async (request, reply) => {
      const session = request.adminSession;
      if (!session) return adminError(request, reply, 403, 'Sitzung abgelaufen.');

      let upload;
      try {
        upload = await readImportUpload(request);
      } catch (error) {
        request.log.warn({ err: error }, 'Import-Datei konnte nicht gelesen werden');
        return reply.redirect(
          `/admin/produkte/import/?fehler=${encodeURIComponent('Die Datei ist zu groß oder konnte nicht gelesen werden (maximal 20 MB).')}`,
          303,
        );
      }

      if (!verifyCsrfToken(session, upload.fields._csrf)) {
        return adminError(request, reply, 403, 'Das Formular ist abgelaufen. Bitte laden Sie die Seite neu.');
      }
      if (!upload.file) {
        return reply.redirect(
          `/admin/produkte/import/?fehler=${encodeURIComponent('Bitte wählen Sie eine JSON-Datei aus.')}`,
          303,
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(upload.file.buffer.toString('utf8'));
      } catch {
        return reply.redirect(
          `/admin/produkte/import/?fehler=${encodeURIComponent('Die Datei enthält kein gültiges JSON.')}`,
          303,
        );
      }

      const parsed = importFileSchema.safeParse(parsedJson);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue ? `${issue.path.join('.') || 'Datei'}: ${issue.message}` : 'Ungültiges Importformat.';
        return reply.redirect(`/admin/produkte/import/?fehler=${encodeURIComponent(message)}`, 303);
      }

      const result = await importProducts(parsed.data);
      writeAudit(request.admin?.email ?? 'admin', 'product.import', {
        file: upload.file.filename,
        imported: result.imported,
        errors: result.errors.length,
      });

      if (result.imported === 0) {
        return reply.redirect(
          `/admin/produkte/import/?fehler=${encodeURIComponent(result.errors[0] ?? 'Es wurden keine Produkte importiert.')}`,
          303,
        );
      }
      const warning = result.errors.length > 0
        ? `&fehler=${encodeURIComponent(result.errors[0] ?? 'Ein Produkt konnte nicht vollständig importiert werden.')}`
        : '';
      return reply.redirect(`/admin/produkte/?gespeichert=1&importiert=${result.imported}${warning}`, 303);
    });

    // Löschen / Kopieren / Massenlöschung --------------------------------
    scope.get<{ Params: { id: string } }>('/admin/produkte/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');
      render(reply, 'admin/confirm.njk', adminContext(request, {
        title: 'Produkt löschen',
        message: `Soll das Produkt „${product.name}“ mit allen Varianten und Bildern endgültig gelöscht werden? Bestellungen bleiben erhalten.`,
        action: `/admin/produkte/${id}/loeschen/`,
        cancel: `/admin/produkte/${id}/`,
      }));
    });

    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');
      removeProduct(id);
      writeAudit(request.admin?.email ?? 'admin', 'product.delete', { id, slug: product.slug, name: product.name });
      return reply.redirect('/admin/produkte/?geloescht=1', 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/kopieren/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');

      const slug = uniqueProductSlug(`${product.slug}-kopie`);
      const maxSort = db()
        .prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM products')
        .get() as { value: number };
      const info = db()
        .prepare(
          `INSERT INTO products
             (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g,
              dimensions, stock, active, sort_order, shipping_method_ids, shipping_option_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          slug,
          `${product.name} (Kopie)`.slice(0, 200),
          product.short_description,
          product.description,
          product.price_from_cents,
          product.price_to_cents,
          product.sku,
          product.weight_g,
          product.dimensions,
          product.stock,
          0,
          maxSort.value + 1,
          product.shipping_method_ids,
          product.shipping_option_ids,
        );
      const productId = Number(info.lastInsertRowid);

      const insertVariant = db().prepare(
        'INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)',
      );
      for (const variant of variantsFor(id)) {
        insertVariant.run(productId, variant.label, variant.price_cents, variant.stock, variant.sort_order);
      }

      let imageSort = 0;
      for (const image of imagesFor(id)) {
        const copied = await duplicateProductImage(image.file, productId);
        if (!copied) continue;
        imageSort += 1;
        db()
          .prepare('INSERT INTO product_images (product_id, file, alt, sort_order) VALUES (?, ?, ?, ?)')
          .run(productId, copied, image.alt, image.sort_order || imageSort);
      }

      writeAudit(request.admin?.email ?? 'admin', 'product.copy', { from: id, to: productId, slug });
      return reply.redirect(`/admin/produkte/${productId}/?gespeichert=1`, 303);
    });

    scope.post('/admin/produkte/massenloeschen/', async (request, reply) => {
      const ids = idList(bodyObject(request).ids);
      const products = ids.length > 0
        ? (db()
            .prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, name`)
            .all(...ids) as ProductRow[])
        : [];
      if (products.length === 0) {
        return reply.redirect(`/admin/produkte/?fehler=${encodeURIComponent('Bitte wählen Sie mindestens ein Produkt aus.')}`, 303);
      }
      render(reply, 'admin/product-bulk-delete.njk', adminContext(request, { products }));
    });

    scope.post('/admin/produkte/massenloeschen/bestaetigen/', async (request, reply) => {
      const ids = idList(bodyObject(request).ids);
      const products = ids.length > 0
        ? (db()
            .prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`)
            .all(...ids) as ProductRow[])
        : [];
      if (products.length === 0) {
        return reply.redirect(`/admin/produkte/?fehler=${encodeURIComponent('Keine Produkte zum Löschen ausgewählt.')}`, 303);
      }
      for (const product of products) removeProduct(product.id);
      writeAudit(request.admin?.email ?? 'admin', 'product.bulk_delete', {
        ids: products.map((product) => product.id),
        names: products.map((product) => product.name),
      });
      return reply.redirect('/admin/produkte/?geloescht=1', 303);
    });

    // Etsy-Import ---------------------------------------------------------
    scope.get('/admin/produkte/etsy/', async (request, reply) => {
      render(reply, 'admin/etsy-import.njk', adminContext(request, {
        importJob: etsyImportJob,
      }));
    });

    scope.get('/admin/produkte/etsy/status/', async (_request, reply) => {
      reply.header('cache-control', 'no-store');
      return reply.send(etsyImportJob);
    });

    scope.post('/admin/produkte/etsy/', async (request, reply) => {
      if (etsyImportJob.running) {
        return reply.redirect('/admin/produkte/etsy/?laeuft=1', 303);
      }

      const contentType = String(request.headers['content-type'] ?? '');
      let mode: 'csv' | 'api' = 'csv';
      let dryRun = false;
      let filePath = '';
      let tempDir = '';
      let apiKey = '';
      let shop = '3DlMIR';
      let error = '';

      try {
        if (contentType.startsWith('multipart/form-data')) {
          const session = request.adminSession;
          if (!session) {
            reply.code(403);
            return render(reply, 'admin/etsy-import.njk', adminContext(request, {
              importJob: etsyImportJob,
              result: { ok: false, output: 'Die Sitzung ist abgelaufen. Bitte erneut anmelden.' },
            }));
          }
          const fields: Record<string, string> = {};
          let csv: Buffer | null = null;
          for await (const part of request.parts()) {
            if (part.type === 'file') {
              if (part.fieldname === 'file') csv = await part.toBuffer();
              else part.file.resume();
            } else {
              fields[part.fieldname] = String(part.value ?? '');
            }
          }
          if (!verifyCsrfToken(session, fields._csrf)) {
            reply.code(403);
            return render(reply, 'admin/etsy-import.njk', adminContext(request, {
              importJob: etsyImportJob,
              result: { ok: false, output: 'Das Formular ist abgelaufen. Bitte die Seite neu laden.' },
            }));
          }
          mode = fields.mode === 'api' ? 'api' : 'csv';
          dryRun = fields.dryRun === '1' || fields.dryRun === 'on';
          if (mode === 'csv') {
            if (!csv || csv.length === 0) {
              error = 'Bitte eine CSV-Datei auswählen.';
            } else {
              tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3d-mir-etsy-'));
              filePath = path.join(tempDir, 'listings.csv');
              fs.writeFileSync(filePath, csv);
            }
          } else {
            apiKey = `${cleanText(fields.apiKey, 120)}:${cleanText(fields.apiSecret, 120)}`;
            shop = cleanText(fields.shop, 80) || '3DlMIR';
          }
        } else {
          const body = bodyObject(request);
          mode = body.mode === 'api' ? 'api' : 'csv';
          dryRun = body.dryRun === '1' || body.dryRun === 'on';
          apiKey = `${cleanText(body.apiKey, 120)}:${cleanText(body.apiSecret, 120)}`;
          shop = cleanText(body.shop, 80) || '3DlMIR';
          if (mode === 'csv') error = 'Bitte die CSV-Datei über das Formular hochladen.';
        }

        if (error) {
          reply.code(400);
          return render(reply, 'admin/etsy-import.njk', adminContext(request, {
            importJob: etsyImportJob,
            result: { ok: false, output: error },
          }));
        }

        const args = mode === 'api' ? ['--api', '--shop', shop] : ['--file', filePath];
        if (dryRun) args.push('--dry-run');
        startEtsyImport(args, mode === 'api' ? { ETSY_API_KEY: apiKey } : {}, tempDir);
        writeAudit(request.admin?.email ?? 'admin', 'products.etsy.import', { mode, dryRun, started: true });
        return reply.redirect('/admin/produkte/etsy/?import=1', 303);
      } catch (importError) {
        request.log.error({ err: importError }, 'Etsy-Import konnte nicht gestartet werden');
        reply.code(500);
        return render(reply, 'admin/etsy-import.njk', adminContext(request, {
          importJob: etsyImportJob,
          result: {
            ok: false,
            output: `Import konnte nicht gestartet werden: ${importError instanceof Error ? importError.message : String(importError)}`,
          },
        }));
      }
    });

    scope.get('/admin/produkte/neu/', async (request, reply) => {
      render(reply, 'admin/product.njk', adminContext(request, {
        product: null,
        form: emptyProductForm(),
        variants: [],
        images: [],
        isNew: true,
        ...productCategoryContext(),
        ...productShippingChoices(),
      }));
    });

    scope.post('/admin/produkte/neu/', async (request, reply) => {
      const body = bodyObject(request);
      const form = readProductForm(body);
      const result = validateProductForm(form);
      if (result.error || !result.data) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product: null,
          form,
          variants: [],
          images: [],
          isNew: true,
          ...productCategoryContext(),
          ...productShippingChoices(),
          error: result.error ?? 'Bitte prüfen Sie Ihre Angaben.',
        }));
      }
      if (productExists(result.data.slug)) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product: null,
          form,
          variants: [],
          images: [],
          isNew: true,
          ...productCategoryContext(),
          ...productShippingChoices(),
          error: 'Dieser Slug wird bereits verwendet.',
        }));
      }
      const data = result.data;
      const info = db()
        .prepare(
          `INSERT INTO products
            (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g, dimensions, stock, active, sort_order, shipping_method_ids, shipping_option_ids)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          data.slug,
          data.name,
          data.shortDescription,
          data.description,
          data.priceFrom,
          data.priceTo,
          data.sku,
          data.weightG,
          data.dimensions,
          data.stock,
          data.active ? 1 : 0,
          data.sortOrder,
          JSON.stringify(data.shippingMethodIds),
          JSON.stringify(data.shippingOptionIds),
        );
      saveProductCategories(Number(info.lastInsertRowid), bodyIds(body.productCategories).map(Number));
      writeAudit(request.admin?.email ?? 'admin', 'product.create', { id: info.lastInsertRowid, slug: data.slug });
      return reply.redirect(`/admin/produkte/${info.lastInsertRowid}/?gespeichert=1`, 303);
    });

    scope.get<{ Params: { id: string } }>('/admin/produkte/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');
      render(reply, 'admin/product.njk', adminContext(request, {
        product,
        form: productFormFromRow(product),
        variants: variantFormRows(id),
        images: imageRowsFor(id),
        isNew: false,
        ...productCategoryContext(id),
        ...productShippingChoices(),
      }));
    });

    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');

      const body = bodyObject(request);
      const form = readProductForm(body);
      const result = validateProductForm(form);
      if (result.error || !result.data) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product,
          form,
          variants: variantFormRows(id),
          images: imageRowsFor(id),
          isNew: false,
          ...productCategoryContext(id),
          ...productShippingChoices(),
          error: result.error ?? 'Bitte prüfen Sie Ihre Angaben.',
        }));
      }
      if (productExists(result.data.slug, id)) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product,
          form,
          variants: variantFormRows(id),
          images: imageRowsFor(id),
          isNew: false,
          ...productCategoryContext(id),
          ...productShippingChoices(),
          error: 'Dieser Slug wird bereits von einem anderen Produkt verwendet.',
        }));
      }
      const data = result.data;
      db()
        .prepare(
          `UPDATE products SET
             slug = ?, name = ?, short_description = ?, description = ?, price_from_cents = ?,
             price_to_cents = ?, sku = ?, weight_g = ?, dimensions = ?, stock = ?, active = ?,
             sort_order = ?, shipping_method_ids = ?, shipping_option_ids = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(
          data.slug,
          data.name,
          data.shortDescription,
          data.description,
          data.priceFrom,
          data.priceTo,
          data.sku,
          data.weightG,
          data.dimensions,
          data.stock,
          data.active ? 1 : 0,
          data.sortOrder,
          JSON.stringify(data.shippingMethodIds),
          JSON.stringify(data.shippingOptionIds),
          id,
        );
      saveProductCategories(id, bodyIds(body.productCategories).map(Number));
      writeAudit(request.admin?.email ?? 'admin', 'product.update', { id, slug: data.slug });
      return reply.redirect(`/admin/produkte/${id}/?gespeichert=1`, 303);
    });

    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/varianten/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');
      const error = updateVariants(id, bodyObject(request));
      if (error) return reply.redirect(`/admin/produkte/${id}/?fehler=${encodeURIComponent(error)}`, 303);
      writeAudit(request.admin?.email ?? 'admin', 'product.variants.update', { id });
      return reply.redirect(`/admin/produkte/${id}/?gespeichert=1`, 303);
    });

    scope.post<{ Params: { id: string; variantId: string } }>(
      '/admin/produkte/:id/varianten/:variantId/loeschen/',
      async (request, reply) => {
        const id = Number(request.params.id);
        const variantId = Number(request.params.variantId);
        if (!Number.isInteger(id) || !Number.isInteger(variantId)) {
          return adminError(request, reply, 404, 'Diese Variante wurde nicht gefunden.');
        }
        const variant = db()
          .prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?')
          .get(variantId, id) as VariantRow | undefined;
        if (!variant) return adminError(request, reply, 404, 'Diese Variante wurde nicht gefunden.');
        db().prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?').run(variantId, id);
        writeAudit(request.admin?.email ?? 'admin', 'product.variant.delete', { product: id, variant: variant.label });
        return reply.redirect(`/admin/produkte/${id}/?gespeichert=1`, 303);
      },
    );

    // Produktbilder -------------------------------------------------------
    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/bilder/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');

      const session = request.adminSession;
      if (!session) return adminError(request, reply, 403, 'Sitzung abgelaufen.');

      const wantsJson =
        String(request.headers.accept ?? '').includes('application/json') ||
        request.headers['x-requested-with'] === 'XMLHttpRequest';
      const fail = (message: string, status = 400) => {
        if (wantsJson) return reply.code(status).send({ ok: false, error: message });
        return reply.redirect(`/admin/produkte/${id}/?fehler=${encodeURIComponent(message)}`, 303);
      };
      const success = (warning?: string) => {
        const target = warning
          ? `/admin/produkte/${id}/?fehler=${encodeURIComponent(warning)}`
          : `/admin/produkte/${id}/?gespeichert=1`;
        if (wantsJson) return reply.send({ ok: true, redirect: target });
        return reply.redirect(target, 303);
      };

      let upload;
      try {
        upload = await readImageUpload(request);
      } catch (error) {
        request.log.warn({ err: error }, 'Bild-Upload konnte nicht gelesen werden');
        return fail('Der Upload war zu groß oder unvollständig. Erlaubt sind bis zu 12 MB pro Bild.');
      }

      const { fields, files } = upload;
      if (!verifyCsrfToken(session, fields._csrf)) {
        if (wantsJson) {
          return reply.code(403).send({ ok: false, error: 'Das Formular ist abgelaufen. Bitte laden Sie die Seite neu.' });
        }
        return adminError(request, reply, 403, 'Das Formular ist abgelaufen. Bitte laden Sie die Seite neu.');
      }
      if (files.length === 0) {
        return fail('Bitte wählen Sie mindestens eine Bilddatei aus.');
      }

      const count = (db().prepare('SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?').get(id) as { count: number }).count;
      const remaining = Math.max(0, MAX_PRODUCT_IMAGES - count);
      if (remaining === 0) {
        return fail(`Maximal ${MAX_PRODUCT_IMAGES} Bilder pro Produkt.`);
      }

      const alt = cleanText(fields.alt, 200) || product.name;
      const maxSort = db()
        .prepare('SELECT COALESCE(MAX(sort_order), 0) AS value FROM product_images WHERE product_id = ?')
        .get(id) as { value: number };
      let sortOrder = maxSort.value;
      let added = 0;
      const errors: string[] = [];

      for (const file of files.slice(0, remaining)) {
        try {
          const stored = await storeProductImage(id, file);
          sortOrder += 1;
          db()
            .prepare('INSERT INTO product_images (product_id, file, alt, sort_order) VALUES (?, ?, ?, ?)')
            .run(id, stored, alt, sortOrder);
          writeAudit(request.admin?.email ?? 'admin', 'product.image.add', { product: id, file: stored, name: file.filename });
          added += 1;
        } catch (error) {
          const message =
            error instanceof FormError || error instanceof ProductImageError
              ? error.message
              : 'Das Bild konnte nicht verarbeitet werden.';
          request.log.warn({ err: error, product: id, file: file.filename }, 'Produktbild konnte nicht gespeichert werden');
          errors.push(`${file.filename}: ${message}`);
        }
      }

      if (files.length > remaining) {
        errors.push(`Nur noch ${remaining} von ${files.length} Bildern konnten übernommen werden (Maximum ${MAX_PRODUCT_IMAGES}).`);
      }

      if (added === 0) {
        return fail(errors[0] ?? 'Die Bilder konnten nicht gespeichert werden.');
      }
      if (errors.length > 0) {
        return success(`${added} Bild(er) gespeichert. ${errors[0]}`);
      }
      return success();
    });

    scope.post<{ Params: { id: string; imageId: string } }>(
      '/admin/produkte/:id/bilder/:imageId/',
      async (request, reply) => {
        const id = Number(request.params.id);
        const imageId = Number(request.params.imageId);
        if (!Number.isInteger(id) || !Number.isInteger(imageId)) {
          return adminError(request, reply, 404, 'Dieses Bild wurde nicht gefunden.');
        }
        const image = db()
          .prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?')
          .get(imageId, id) as ImageRow | undefined;
        if (!image) return adminError(request, reply, 404, 'Dieses Bild wurde nicht gefunden.');

        const body = bodyObject(request);
        if (body.delete === '1' || body.delete === 'on') {
          deleteProductImageFiles(image.file);
          db().prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?').run(imageId, id);
          writeAudit(request.admin?.email ?? 'admin', 'product.image.delete', { product: id, file: image.file });
          return reply.redirect(`/admin/produkte/${id}/?gespeichert=1`, 303);
        }

        const alt = cleanText(body.alt, 200);
        const sortOrder = intOrNull(body.sortOrder);
        if (sortOrder === null || sortOrder < 0 || sortOrder > 1000) {
          return reply.redirect(`/admin/produkte/${id}/?fehler=${encodeURIComponent('Bitte eine Sortierung zwischen 0 und 1000 angeben.')}`, 303);
        }
        db()
          .prepare('UPDATE product_images SET alt = ?, sort_order = ? WHERE id = ? AND product_id = ?')
          .run(alt, sortOrder, imageId, id);
        writeAudit(request.admin?.email ?? 'admin', 'product.image.update', { product: id, image: imageId });
        return reply.redirect(`/admin/produkte/${id}/?gespeichert=1`, 303);
      },
    );

    // Zahlungen -----------------------------------------------------------
    scope.get('/admin/zahlungen/', async (request, reply) => {
      const settings = getShopSettings();
      render(reply, 'admin/payments.njk', adminContext(request, {
        settings,
        stripeConfigured: isStripeConfigured(),
        stripeMode: config.stripe.mode,
        bankConfigured: isBankConfigured(settings.bank),
        publicMethods: getPublicPaymentMethods(),
      }));
    });

    scope.post('/admin/zahlungen/', async (request, reply) => {
      const body = bodyObject(request);
      const current = getShopSettings();
      const bank: BankDetails = {
        accountHolder: cleanText(body.bankAccountHolder, 120),
        iban: cleanText(body.bankIban, 40).replace(/\s+/g, '').toUpperCase(),
        bic: cleanText(body.bankBic, 20).replace(/\s+/g, '').toUpperCase(),
        bankName: cleanText(body.bankName, 120),
      };
      const methods: PaymentMethodSetting[] = current.paymentMethods.map((method) => {
        const sortOrder = intOrNull(body[`method_${method.id}_sortOrder`]);
        return {
          ...method,
          label: cleanText(body[`method_${method.id}_label`], 120) || method.label,
          note: cleanText(body[`method_${method.id}_note`], 300),
          enabled:
            body[`method_${method.id}_enabled`] === '1' || body[`method_${method.id}_enabled`] === 'on',
          sortOrder: sortOrder === null ? method.sortOrder : Math.max(-1000, Math.min(1000, sortOrder)),
        };
      });

      const fail = (message: string) => {
        reply.code(400);
        return render(reply, 'admin/payments.njk', adminContext(request, {
          settings: { bank, paymentMethods: methods },
          stripeConfigured: isStripeConfigured(),
          stripeMode: config.stripe.mode,
          bankConfigured: isBankConfigured(bank),
          publicMethods: methods.filter((method) => method.enabled),
          error: message,
        }));
      };

      if (bank.iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(bank.iban)) {
        return fail('Bitte geben Sie eine gültige IBAN ein.');
      }
      if (bank.bic && !/^[A-Z0-9]{8,11}$/.test(bank.bic)) {
        return fail('Bitte geben Sie eine gültige BIC ein.');
      }
      if (bank.accountHolder && !bank.iban) {
        return fail('Bitte geben Sie zum Kontoinhaber auch eine IBAN an.');
      }
      if (bank.iban && !bank.accountHolder) {
        return fail('Bitte geben Sie zur IBAN auch den Kontoinhaber an.');
      }

      saveShopSettings({ bank, paymentMethods: methods });
      writeAudit(request.admin?.email ?? 'admin', 'shop.payment.update', {
        bankConfigured: isBankConfigured(bank),
        methods: methods.map((method) => ({ id: method.id, enabled: method.enabled })),
      });
      return reply.redirect('/admin/zahlungen/?gespeichert=1', 303);
    });

    // Veröffentlichung ----------------------------------------------------
    scope.get('/admin/veroeffentlichung/', async (request, reply) => {
      render(reply, 'admin/publication.njk', adminContext(request, {
        publication: getPublicationSettings(),
      }));
    });

    scope.post('/admin/veroeffentlichung/', async (request, reply) => {
      const body = bodyObject(request);
      const mark = (name: string): boolean => body[name] === '1' || body[name] === 'on';
      const settings: PublicationSettings = {
        shopStatus: mark('shopLive') ? 'AKTIV' : 'PLATZHALTER',
        pricingStatus: mark('pricingFinal') ? 'FINAL' : 'PLATZHALTER',
        shippingStatus: mark('shippingFinal') ? 'FINAL' : 'PLATZHALTER',
        showLegalDraftNotice: mark('showLegalDraftNotice'),
      };
      savePublicationSettings(settings);
      writeAudit(request.admin?.email ?? 'admin', 'publication.update', settings);
      return reply.redirect('/admin/veroeffentlichung/?gespeichert=1', 303);
    });

    // Benachrichtigungen --------------------------------------------------
    scope.get('/admin/benachrichtigungen/', async (request, reply) => {
      const settings = getNotificationSettings();
      const overrides = getNotificationOverrides();
      const query = queryObject(request);
      render(reply, 'admin/notifications.njk', adminContext(request, {
        settings,
        channelLabel: notificationChannelLabel(settings.channel),
        smtpConfigured: isSmtpConfigured(settings),
        telegramConfigured: isTelegramConfigured(settings),
        smtpFromEnv: !overrides.smtp?.host && Boolean(config.mail.host),
        telegramFromEnv:
          !overrides.telegram?.botToken && Boolean(config.notifications.telegramBotToken),
        smtpPassSet: Boolean(settings.smtp.pass),
        telegramTokenSet: Boolean(settings.telegram.botToken),
        test: typeof query.test === 'string' ? query.test : '',
      }));
    });

    scope.post('/admin/benachrichtigungen/', async (request, reply) => {
      const body = bodyObject(request);
      const overrides = getNotificationOverrides();
      const selected = cleanText(body.channel, 20);
      const channel: NotificationChannel =
        selected === 'telegram' || selected === 'both' ? selected : 'mail';
      const port = Number(body.smtpPort);
      const smtpPassInput = typeof body.smtpPass === 'string' ? body.smtpPass.slice(0, 500) : '';
      const telegramTokenInput =
        typeof body.telegramToken === 'string' ? body.telegramToken.slice(0, 300) : '';

      const settings: NotificationSettings = {
        channel,
        smtp: {
          host: cleanText(body.smtpHost, 200),
          port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 587,
          secure: body.smtpSecure === '1' || body.smtpSecure === 'on',
          user: cleanText(body.smtpUser, 200),
          pass: smtpPassInput || (overrides.smtp?.pass ?? ''),
          from: cleanText(body.smtpFrom, 300),
          to: cleanText(body.smtpTo, 300),
        },
        telegram: {
          botToken: telegramTokenInput || (overrides.telegram?.botToken ?? ''),
          chatId: cleanText(body.telegramChatId, 100),
        },
      };

      saveNotificationSettings(settings);
      resetMailTransporter();
      writeAudit(request.admin?.email ?? 'admin', 'notifications.update', {
        channel: settings.channel,
        smtpConfigured: Boolean(settings.smtp.host),
        telegramConfigured: Boolean(settings.telegram.botToken && settings.telegram.chatId),
      });
      return reply.redirect('/admin/benachrichtigungen/?gespeichert=1', 303);
    });

    scope.post('/admin/benachrichtigungen/test-mail/', async (request, reply) => {
      try {
        const result = await sendMail({
          subject: `[Test] Benachrichtigung von 3D-MIR`,
          text: [
            'Dies ist eine Testnachricht aus dem Admin-Bereich.',
            '',
            `Zeitpunkt: ${new Date().toLocaleString('de-DE')}`,
            '',
            'Wenn Sie diese Nachricht erhalten, ist der E-Mail-Versand eingerichtet.',
          ].join('\n'),
        });
        return reply.redirect(
          `/admin/benachrichtigungen/?test=${result.delivered ? 'mail-ok' : 'mail-file'}`,
          303,
        );
      } catch (error) {
        request.log.warn({ err: error }, 'Test-E-Mail fehlgeschlagen');
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        return reply.redirect(
          `/admin/benachrichtigungen/?fehler=${encodeURIComponent(`Test-E-Mail fehlgeschlagen: ${message}`)}`,
          303,
        );
      }
    });

    scope.post('/admin/benachrichtigungen/test-telegram/', async (request, reply) => {
      try {
        await sendTelegramMessage(
          [
            '3D-MIR Testnachricht',
            '',
            'Wenn Sie diese Nachricht sehen, ist Telegram korrekt eingerichtet.',
            `Zeitpunkt: ${new Date().toLocaleString('de-DE')}`,
          ].join('\n'),
        );
        return reply.redirect('/admin/benachrichtigungen/?test=telegram-ok', 303);
      } catch (error) {
        request.log.warn({ err: error }, 'Test-Telegram fehlgeschlagen');
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        return reply.redirect(
          `/admin/benachrichtigungen/?fehler=${encodeURIComponent(`Test-Telegram fehlgeschlagen: ${message}`)}`,
          303,
        );
      }
    });

    // Preise --------------------------------------------------------------
    scope.get('/admin/preise/', async (request, reply) => {
      const pricing = getPricingConfig({ includeInactive: true });
      render(reply, 'admin/prices.njk', adminContext(request, {
        pricing,
        view: pricingView(pricing),
        hasOverrides: Object.keys(getPricingOverrides()).length > 0,
      }));
    });

    scope.post('/admin/preise/', async (request, reply) => {
      const pricing = getPricingConfig({ includeInactive: true });
      const body = bodyObject(request);
      const result = readPricingForm(body, pricing);
      if (result.error || !result.overrides) {
        reply.code(400);
        return render(reply, 'admin/prices.njk', adminContext(request, {
          pricing,
          view: pricingView(pricing),
          hasOverrides: Object.keys(getPricingOverrides()).length > 0,
          error: result.error ?? 'Bitte prüfen Sie Ihre Angaben.',
        }));
      }
      savePricingOverrides(result.overrides);
      writeAudit(request.admin?.email ?? 'admin', 'pricing.update', result.overrides);
      return reply.redirect('/admin/preise/?gespeichert=1', 303);
    });

    scope.post('/admin/preise/zuruecksetzen/', async (request, reply) => {
      clearPricingOverrides();
      writeAudit(request.admin?.email ?? 'admin', 'pricing.reset', {});
      return reply.redirect('/admin/preise/?zurueckgesetzt=1', 303);
    });

    // Passwort ------------------------------------------------------------
    scope.get('/admin/passwort/', async (request, reply) => {
      render(reply, 'admin/password.njk', adminContext(request, {}));
    });

    scope.post('/admin/passwort/', async (request, reply) => {
      const body = bodyObject(request);
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const next = typeof body.newPassword === 'string' ? body.newPassword : '';
      const repeat = typeof body.repeatPassword === 'string' ? body.repeatPassword : '';
      const session = request.adminSession;
      if (!session) return adminError(request, reply, 403, 'Sitzung abgelaufen.');

      const row = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(session.user.id) as
        | { password_hash: string }
        | undefined;
      const fail = (message: string) => {
        reply.code(400);
        return render(reply, 'admin/password.njk', adminContext(request, { error: message }));
      };
      if (!row || !(await verifyPassword(row.password_hash, current))) return fail('Das aktuelle Passwort ist nicht korrekt.');
      if (next.length < 12) return fail('Das neue Passwort muss mindestens 12 Zeichen lang sein.');
      if (next !== repeat) return fail('Die beiden neuen Passwörter stimmen nicht überein.');

      const hash = await hashPassword(next);
      db().prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, session.user.id);
      db().prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(session.user.id, session.id);
      writeAudit(session.user.email, 'admin.password.change', { ip: request.ip });
      return reply.redirect('/admin/passwort/?gespeichert=1', 303);
    });
  });
}
