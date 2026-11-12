import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config, type PricingConfig } from '../config.js';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { sendMail } from '../lib/mailer.js';
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
import { formatEuro } from '../lib/shop.js';

const db = () => getDb();

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
  shipping_method: string;
  shipping_cents: number;
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
  handled: number;
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
};

function orderStatusLabel(status: string): string {
  return orderStatuses.find((item) => item.id === status)?.label ?? status;
}

function quoteStatusLabel(status: string): string {
  return quoteStatuses.find((item) => item.id === status)?.label ?? status;
}

function paymentLabel(id: string): string {
  return config.shop.payment.methods.find((method) => method.id === id)?.label ?? id;
}

function shippingLabel(id: string): string {
  return getPricingConfig().shipping.methods.find((method) => method.id === id)?.label ?? id;
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
    .slice(0, 120);
}

function queryObject(request: FastifyRequest): Record<string, unknown> {
  return (request.query ?? {}) as Record<string, unknown>;
}

function bodyObject(request: FastifyRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function flash(request: FastifyRequest) {
  const query = queryObject(request);
  return {
    gespeichert: query.gespeichert === '1',
    geloescht: query.geloescht === '1',
    zurueckgesetzt: query.zurueckgesetzt === '1',
    fehler: typeof query.fehler === 'string' ? query.fehler : '',
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
    if (!verifyCsrf(session, request)) {
      await adminError(request, reply, 403, 'Das Formular ist abgelaufen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.');
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
    },
  };
}

function productExists(slug: string, exceptId?: number): boolean {
  const row = exceptId
    ? db().prepare('SELECT 1 FROM products WHERE slug = ? AND id <> ?').get(slug, exceptId)
    : db().prepare('SELECT 1 FROM products WHERE slug = ?').get(slug);
  return Boolean(row);
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

class FormError extends Error {}

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

function pricingFormValues(pricing: PricingConfig): Record<string, string> {
  const values: Record<string, string> = {
    meta_min_order: String(pricing.meta.minOrderValue),
    meta_setup: String(pricing.meta.setupFee),
    meta_setup_extra: String(pricing.meta.setupFeePerExtraPart),
    meta_round: String(pricing.meta.roundTo),
    calc_wall: String(pricing.calculation.wallThicknessMm),
    calc_flow: String(pricing.calculation.materialCm3PerHour),
    calc_waste: String(pricing.calculation.wastePercent),
    shipping_free_from: String(pricing.shipping.freeShippingFrom),
  };
  for (const material of pricing.materials) {
    values[`material_${material.id}_price`] = String(material.pricePerGram);
    values[`material_${material.id}_density`] = String(material.density);
  }
  for (const printer of pricing.printers) values[`printer_${printer.id}_rate`] = String(printer.hourlyRate);
  for (const coating of pricing.coatings) values[`coating_${coating.id}_price`] = String(coating.pricePerPart);
  for (const method of pricing.shipping.methods) values[`shipping_${method.id}_price`] = String(method.price);
  pricing.quantityDiscounts.forEach((tier, index) => {
    values[`discount_${index}`] = String(tier.percent);
  });
  return values;
}

function readPricingForm(body: Record<string, unknown>, pricing: PricingConfig): { overrides?: PricingOverrides; error?: string } {
  const numberField = (name: string, min: number, max: number, label: string): number => {
    const value = parseDecimal(body[name]);
    if (value === null || value < min || value > max) {
      throw new FormError(`${label}: Bitte einen Wert zwischen ${min} und ${max} angeben.`);
    }
    return value;
  };

  try {
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
      materials: {},
      printers: {},
      coatings: {},
      shipping: { methods: {} },
      quantityDiscounts: [],
    };

    for (const material of pricing.materials) {
      overrides.materials![material.id] = {
        pricePerGram: numberField(`material_${material.id}_price`, 0, 1000, `Materialpreis ${material.label}`),
        density: numberField(`material_${material.id}_density`, 0.1, 30, `Dichte ${material.label}`),
      };
    }
    for (const printer of pricing.printers) {
      overrides.printers![printer.id] = {
        hourlyRate: numberField(`printer_${printer.id}_rate`, 0, 1000, `Maschinenstunde ${printer.label}`),
      };
    }
    for (const coating of pricing.coatings) {
      overrides.coatings![coating.id] = {
        pricePerPart: numberField(`coating_${coating.id}_price`, 0, 10000, `Nachbearbeitung ${coating.label}`),
      };
    }
    for (const method of pricing.shipping.methods) {
      overrides.shipping!.methods![method.id] = {
        price: numberField(`shipping_${method.id}_price`, 0, 1000, `Versandkosten ${method.label}`),
      };
    }
    overrides.shipping!.freeShippingFrom = numberField('shipping_free_from', 0, 100000, 'Kostenloser Versand ab');

    pricing.quantityDiscounts.forEach((tier, index) => {
      overrides.quantityDiscounts!.push({
        minQuantity: tier.minQuantity,
        percent: numberField(`discount_${index}`, 0, 100, `Mengenrabatt ab ${tier.minQuantity} Stück`),
      });
    });

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
      const revenue = (
        db()
          .prepare(
            "SELECT COALESCE(SUM(total_cents), 0) AS cents FROM orders WHERE status IN ('bezahlt', 'in_druck', 'versandt', 'abgeschlossen')",
          )
          .get() as { cents: number }
      ).cents;

      render(
        reply,
        'admin/dashboard.njk',
        adminContext(request, {
          counts,
          openOrders,
          newQuotes,
          openMessages,
          revenue,
          recentOrders: db()
            .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 6')
            .all() as OrderRow[],
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
      const q = cleanText(query.q, 100);
      const where: string[] = [];
      const params: unknown[] = [];
      if (status) {
        where.push('status = ?');
        params.push(status);
      }
      if (q) {
        where.push('(order_number LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      const orders = db()
        .prepare(`SELECT * FROM orders ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT 200`)
        .all(...params) as OrderRow[];
      render(
        reply,
        'admin/orders.njk',
        adminContext(request, { orders, statuses: orderStatuses, status, q }),
      );
    });

    scope.get<{ Params: { id: string } }>('/admin/bestellungen/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const order = Number.isInteger(id) ? (db().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined) : undefined;
      if (!order) return adminError(request, reply, 404, 'Diese Bestellung wurde nicht gefunden.');
      const items = db().prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id) as OrderItemRow[];
      const history = db()
        .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC, id DESC')
        .all(id) as { from_status: string; to_status: string; actor: string; note: string; created_at: string }[];
      render(
        reply,
        'admin/order.njk',
        adminContext(request, {
          order,
          items,
          history,
          statuses: orderStatuses,
          paymentLabel: paymentLabel(order.payment_method),
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
      writeAudit(request.admin?.email ?? 'admin', 'order.update', { order: order.order_number, from: order.status, to: status });

      if (notify && status !== order.status) {
        await notifyOrderStatus(request, { ...order, status }, status);
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
      const pricing = getPricingConfig();
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
    scope.get('/admin/nachrichten/', async (request, reply) => {
      const messages = db()
        .prepare('SELECT * FROM contact_messages ORDER BY handled ASC, created_at DESC, id DESC LIMIT 300')
        .all() as ContactRow[];
      render(reply, 'admin/messages.njk', adminContext(request, { messages }));
    });

    scope.post<{ Params: { id: string } }>('/admin/nachrichten/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as ContactRow | undefined)
        : undefined;
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      const handled = bodyObject(request).handled === '1' || bodyObject(request).handled === 'on';
      db().prepare('UPDATE contact_messages SET handled = ? WHERE id = ?').run(handled ? 1 : 0, id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.update', { id, handled });
      return reply.redirect('/admin/nachrichten/?gespeichert=1', 303);
    });

    scope.get<{ Params: { id: string } }>('/admin/nachrichten/:id/loeschen/', async (request, reply) => {
      const id = Number(request.params.id);
      const message = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as ContactRow | undefined)
        : undefined;
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
      const message = Number.isInteger(id)
        ? (db().prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as ContactRow | undefined)
        : undefined;
      if (!message) return adminError(request, reply, 404, 'Diese Nachricht wurde nicht gefunden.');
      db().prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
      writeAudit(request.admin?.email ?? 'admin', 'contact.delete', { id, email: message.email });
      return reply.redirect('/admin/nachrichten/?geloescht=1', 303);
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

    scope.get('/admin/produkte/neu/', async (request, reply) => {
      render(reply, 'admin/product.njk', adminContext(request, {
        product: null,
        form: emptyProductForm(),
        variants: [],
        images: [],
        isNew: true,
      }));
    });

    scope.post('/admin/produkte/neu/', async (request, reply) => {
      const form = readProductForm(bodyObject(request));
      const result = validateProductForm(form);
      if (result.error || !result.data) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product: null,
          form,
          variants: [],
          images: [],
          isNew: true,
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
          error: 'Dieser Slug wird bereits verwendet.',
        }));
      }
      const data = result.data;
      const info = db()
        .prepare(
          `INSERT INTO products
            (slug, name, short_description, description, price_from_cents, price_to_cents, sku, weight_g, dimensions, stock, active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        );
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
        images: imagesFor(id),
        isNew: false,
      }));
    });

    scope.post<{ Params: { id: string } }>('/admin/produkte/:id/', async (request, reply) => {
      const id = Number(request.params.id);
      const product = Number.isInteger(id) ? findProduct(id) : undefined;
      if (!product) return adminError(request, reply, 404, 'Dieses Produkt wurde nicht gefunden.');

      const form = readProductForm(bodyObject(request));
      const result = validateProductForm(form);
      if (result.error || !result.data) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product,
          form,
          variants: variantFormRows(id),
          images: imagesFor(id),
          isNew: false,
          error: result.error ?? 'Bitte prüfen Sie Ihre Angaben.',
        }));
      }
      if (productExists(result.data.slug, id)) {
        reply.code(400);
        return render(reply, 'admin/product.njk', adminContext(request, {
          product,
          form,
          variants: variantFormRows(id),
          images: imagesFor(id),
          isNew: false,
          error: 'Dieser Slug wird bereits von einem anderen Produkt verwendet.',
        }));
      }
      const data = result.data;
      db()
        .prepare(
          `UPDATE products SET
             slug = ?, name = ?, short_description = ?, description = ?, price_from_cents = ?,
             price_to_cents = ?, sku = ?, weight_g = ?, dimensions = ?, stock = ?, active = ?,
             sort_order = ?, updated_at = datetime('now')
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
          id,
        );
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

    // Preise --------------------------------------------------------------
    scope.get('/admin/preise/', async (request, reply) => {
      const pricing = getPricingConfig();
      const values = pricingFormValues(pricing);
      render(reply, 'admin/prices.njk', adminContext(request, {
        pricing,
        values,
        materialRows: pricing.materials.map((material) => ({
          ...material,
          priceValue: values[`material_${material.id}_price`] ?? '',
          densityValue: values[`material_${material.id}_density`] ?? '',
        })),
        printerRows: pricing.printers.map((printer) => ({
          ...printer,
          rateValue: values[`printer_${printer.id}_rate`] ?? '',
        })),
        coatingRows: pricing.coatings.map((coating) => ({
          ...coating,
          priceValue: values[`coating_${coating.id}_price`] ?? '',
        })),
        shippingRows: pricing.shipping.methods.map((method) => ({
          ...method,
          priceValue: values[`shipping_${method.id}_price`] ?? '',
        })),
        discountRows: pricing.quantityDiscounts.map((tier, index) => ({
          ...tier,
          index,
          percentValue: values[`discount_${index}`] ?? '',
        })),
        hasOverrides: Object.keys(getPricingOverrides()).length > 0,
      }));
    });

    scope.post('/admin/preise/', async (request, reply) => {
      const pricing = getPricingConfig();
      const body = bodyObject(request);
      const result = readPricingForm(body, pricing);
      if (result.error || !result.overrides) {
        const values = { ...pricingFormValues(pricing) };
        for (const [key, value] of Object.entries(body)) {
          if (typeof value === 'string') values[key] = value;
        }
        reply.code(400);
        return render(reply, 'admin/prices.njk', adminContext(request, {
          pricing,
          values,
          materialRows: pricing.materials.map((material) => ({
            ...material,
            priceValue: values[`material_${material.id}_price`] ?? '',
            densityValue: values[`material_${material.id}_density`] ?? '',
          })),
          printerRows: pricing.printers.map((printer) => ({
            ...printer,
            rateValue: values[`printer_${printer.id}_rate`] ?? '',
          })),
          coatingRows: pricing.coatings.map((coating) => ({
            ...coating,
            priceValue: values[`coating_${coating.id}_price`] ?? '',
          })),
          shippingRows: pricing.shipping.methods.map((method) => ({
            ...method,
            priceValue: values[`shipping_${method.id}_price`] ?? '',
          })),
          discountRows: pricing.quantityDiscounts.map((tier, index) => ({
            ...tier,
            index,
            percentValue: values[`discount_${index}`] ?? '',
          })),
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
