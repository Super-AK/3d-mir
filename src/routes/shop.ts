import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { sendMail } from '../lib/mailer.js';
import { notifyAdmin } from '../lib/notifications.js';
import { cleanText, createReference, isSameOrigin } from '../lib/http.js';
import { mailButton, mailLayout, mailLink, mailNotice, mailParagraph, mailSection, mailTable } from '../lib/mail-layout.js';
import { clearCart, readCart, writeCart, cartLineKey, type Cart } from '../lib/cart.js';
import { getPricingConfig } from '../lib/pricing-config.js';
import { allCategories, categoriesForProduct, findCategoryBySlug } from '../lib/categories.js';
import type { PricingConfig } from '../config.js';
import {
  findCheckoutPaymentMethod,
  findPaymentMethod,
  getPublicPaymentMethods,
  isBankConfigured,
  type BankDetails,
} from '../lib/shop-settings.js';
import {
  createPaymentForOrder,
  getBankDetails,
  getOrderItems,
  getOrderOptions,
  getPaymentOrderByAccess,
  getPaymentOrderById,
  markOrderPaymentFailed,
  paymentStatusLabel,
  paymentStatusTone,
  publicOrderUrl,
  reconcileStripeSession,
  releaseStock,
  type PaymentOrder,
} from '../lib/payments/index.js';
import {
  formatEuro,
  orderTotals,
  shippingCents,
  subtotalCents,
  type ShippingMethod,
} from '../lib/shop.js';

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
  color_options: string;
  personalization_enabled: number;
};

type VariantRow = {
  id: number;
  product_id: number;
  label: string;
  price_cents: number;
  stock: number | null;
  sort_order: number;
};

type ImageRow = { file: string; alt: string; sort_order: number };

type ProductListItem = ProductRow & {
  image: string | null;
  variant_min_price: number | null;
  variant_max_price: number | null;
  priceLabel: string;
};

type CartLine = {
  key: string;
  variantId: number | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  variantLabel: string;
  color: string;
  personalization: string;
  productId: number;
  productSlug: string;
  productName: string;
  stock: number | null;
  shippingMethodIds: string[];
  shippingOptionIds: string[];
};

type ShippingAddon = PricingConfig['shipping']['options'][number];

type ShippingOption = ShippingMethod & { cents: number; free: boolean };

const db = () => getDb();

function parseIdList(value: string | null | undefined): string[] {
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

/** Versandarten, die für alle Produkte im Warenkorb erlaubt sind. */
function availableShippingMethods(shipping: PricingConfig['shipping'], lines: CartLine[]) {
  const methods = shipping.methods.filter((method) => method.active !== false);
  const restricted = lines.filter((line) => line.shippingMethodIds.length > 0);
  if (restricted.length === 0) return methods;
  const allowed = methods.filter((method) =>
    restricted.every((line) => line.shippingMethodIds.includes(method.id)),
  );
  return allowed.length > 0 ? allowed : methods;
}

/** Zusatzoptionen, die mindestens einem Produkt im Warenkorb zugeordnet sind. */
function availableShippingAddons(shipping: PricingConfig['shipping'], lines: CartLine[]): ShippingAddon[] {
  const assigned = new Set(lines.flatMap((line) => line.shippingOptionIds));
  if (assigned.size === 0) return [];
  return shipping.options.filter((option) => option.active !== false && assigned.has(option.id));
}

function addonCents(options: ShippingAddon[]): number {
  return options.reduce((sum, option) => sum + Math.max(0, Math.round(option.price * 100)), 0);
}

/** Zerlegt die kommagetrennte Farbliste eines Produkts. */
function productColors(product: Pick<ProductRow, 'color_options'>): string[] {
  return product.color_options
    .split(',')
    .map((color) => color.trim())
    .filter((color) => color.length > 0);
}

/** Findet eine Farbe ohne Beachtung der Groß-/Kleinschreibung und liefert die Schreibweise aus der Datenbank. */
function matchColor(colors: string[], value: string): string | null {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return null;
  return colors.find((color) => color.toLowerCase() === wanted) ?? null;
}

function listProducts(categorySlug?: string): ProductListItem[] {
  const categoryFilter = categorySlug
    ? `AND p.id IN (
         SELECT l.product_id FROM product_category_links l
         JOIN product_categories c ON c.id = l.category_id
         WHERE c.slug = ?
       )`
    : '';
  const rows = db()
    .prepare(
      `SELECT p.*, (
         SELECT file FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1
       ) AS image,
       (SELECT MIN(v.price_cents) FROM product_variants v WHERE v.product_id = p.id) AS variant_min_price,
       (SELECT MAX(v.price_cents) FROM product_variants v WHERE v.product_id = p.id) AS variant_max_price,
       (SELECT c.name FROM product_category_links l JOIN product_categories c ON c.id = l.category_id
         WHERE l.product_id = p.id ORDER BY c.sort_order, c.name LIMIT 1) AS category_name
       FROM products p
       WHERE p.active = 1 ${categoryFilter}
       ORDER BY p.sort_order, p.name`,
    )
    .all(...(categorySlug ? [categorySlug] : [])) as (ProductRow & {
    image: string | null;
    variant_min_price: number | null;
    variant_max_price: number | null;
    category_name: string | null;
  })[];

  return rows.map((row) => {
    const min = row.variant_min_price ?? row.price_from_cents;
    const max = row.variant_max_price ?? row.price_from_cents;
    return {
      ...row,
      categoryName: row.category_name ?? '3D-Druck',
      priceLabel: max > min ? `ab ${formatEuro(min)}` : formatEuro(min),
    };
  });
}

function findProduct(slug: string): { product: ProductRow; variants: VariantRow[]; images: ImageRow[] } | null {
  const product = db().prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug) as ProductRow | undefined;
  if (!product) return null;
  const variants = db()
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id')
    .all(product.id) as VariantRow[];
  const images = db()
    .prepare('SELECT file, alt, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id')
    .all(product.id) as ImageRow[];
  return { product, variants, images };
}

function findProductById(id: number): { product: ProductRow; variants: VariantRow[] } | null {
  const product = db().prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id) as ProductRow | undefined;
  if (!product) return null;
  const variants = db()
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id')
    .all(product.id) as VariantRow[];
  return { product, variants };
}

/** Löst den Cookie-Warenkorb gegen die Datenbank auf. Preise kommen nie aus dem Cookie. */
function loadCartLines(cart: Cart): CartLine[] {
  if (cart.items.length === 0) return [];

  const productIds = [...new Set(cart.items.map((item) => item.productId))];
  const productPlaceholders = productIds.map(() => '?').join(',');
  const products = db()
    .prepare(`SELECT * FROM products WHERE active = 1 AND id IN (${productPlaceholders})`)
    .all(...productIds) as ProductRow[];
  const byProductId = new Map(products.map((product) => [product.id, product]));

  const variantIds = [...new Set(cart.items.map((item) => item.variantId).filter((id): id is number => id !== null))];
  const variants = variantIds.length > 0
    ? (db()
        .prepare(
          `SELECT * FROM product_variants WHERE id IN (${variantIds.map(() => '?').join(',')})`,
        )
        .all(...variantIds) as VariantRow[])
    : [];
  const byVariantId = new Map(variants.map((variant) => [variant.id, variant]));

  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const product = byProductId.get(item.productId);
    if (!product) continue;

    const variant = item.variantId === null ? null : byVariantId.get(item.variantId) ?? null;
    if (item.variantId !== null && (!variant || variant.product_id !== product.id)) continue;

    const colors = productColors(product);
    let color = '';
    if (colors.length > 0 && item.color) {
      const matched = matchColor(colors, item.color);
      if (!matched) continue;
      color = matched;
    } else if (colors.length === 0) {
      color = '';
    } else {
      // Farbe ist bei hinterlegten Farben Pflicht; veraltete Cookie-Zeilen verwerfen.
      continue;
    }

    const personalization = product.personalization_enabled === 1 ? item.personalization : '';
    const quantity = Math.min(config.shop.maxQuantityPerItem, Math.max(1, item.quantity));
    const unitPriceCents = variant ? variant.price_cents : product.price_from_cents;
    lines.push({
      key: cartLineKey(item),
      variantId: variant ? variant.id : null,
      quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      variantLabel: variant ? variant.label : '',
      color,
      personalization,
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      stock: variant ? variant.stock : product.stock,
      shippingMethodIds: parseIdList(product.shipping_method_ids),
      shippingOptionIds: parseIdList(product.shipping_option_ids),
    });
  }
  return lines;
}

function shippingOptions(subtotal: number, lines: CartLine[]): ShippingOption[] {
  const shipping = getPricingConfig().shipping;
  return availableShippingMethods(shipping, lines).map((method) => {
    const cents = shippingCents(shipping, method, subtotal);
    return { ...method, cents, free: cents === 0 && method.price > 0 };
  });
}

function productJsonLd(product: ProductRow, variants: VariantRow[]) {
  const prices = variants.map((variant) => variant.price_cents);
  const low = prices.length > 0 ? Math.min(...prices) : product.price_from_cents;
  const high = prices.length > 0 ? Math.max(...prices) : product.price_from_cents;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.short_description,
      sku: product.sku ?? undefined,
      image: [`${config.site.baseUrl}/assets/img/gen/product-battery-box-900.jpg`],
      brand: { '@type': 'Brand', name: config.site.business.name },
      manufacturer: {
        '@type': 'Organization',
        name: config.site.business.legalName,
        email: config.site.business.email,
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.site.business.street,
          postalCode: config.site.business.zip,
          addressLocality: config.site.business.city,
          addressCountry: config.site.business.countryCode,
        },
      },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'EUR',
        lowPrice: (low / 100).toFixed(2),
        highPrice: (high / 100).toFixed(2),
        offerCount: Math.max(1, variants.length),
        availability: 'https://schema.org/InStock',
        url: `${config.site.baseUrl}/shop/${product.slug}/`,
        seller: { '@type': 'Organization', name: config.site.business.legalName },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: `${config.site.baseUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${config.site.baseUrl}/shop/` },
        {
          '@type': 'ListItem',
          position: 3,
          name: product.name,
          item: `${config.site.baseUrl}/shop/${product.slug}/`,
        },
      ],
    },
  ];
}

function secureCookie(request: FastifyRequest): boolean {
  return request.protocol === 'https';
}

function shopError(reply: FastifyReply, status: number, message: string) {
  reply.code(status);
  return render(reply, 'pages/shop-fehler.njk', { message });
}

// ---------------------------------------------------------------------------
// Kasse
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  firstName: z.string().min(2, 'Bitte geben Sie Ihren Vornamen an.').max(80),
  lastName: z.string().min(2, 'Bitte geben Sie Ihren Nachnamen an.').max(80),
  email: z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse an.').max(200),
  company: z.string().max(160),
  street: z.string().min(3, 'Bitte geben Sie Straße und Hausnummer an.').max(160),
  addressExtra: z.string().max(160),
  zip: z.string().regex(/^\d{4,5}$/, 'Bitte geben Sie eine gültige Postleitzahl an.'),
  city: z.string().min(2, 'Bitte geben Sie den Ort an.').max(100),
  country: z.string().length(2, 'Bitte wählen Sie ein Lieferland.'),
  phone: z.string().max(60),
  paymentMethod: z.string().min(1, 'Bitte wählen Sie eine Zahlungsart.'),
  shippingMethod: z.string().min(1, 'Bitte wählen Sie eine Versandart.'),
  shippingOptions: z.array(z.string().max(60)).default([]),
  customerNote: z.string().max(1000),
  consent: z.literal('1', {
    errorMap: () => ({ message: 'Bitte akzeptieren Sie AGB und Widerrufsbelehrung.' }),
  }),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

function selectedIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [
    ...new Set(
      values.filter((entry): entry is string => typeof entry === 'string' && /^[a-z0-9-]+$/.test(entry)),
    ),
  ];
}

function readCheckoutForm(request: FastifyRequest): CheckoutForm {
  const body = (request.body ?? {}) as Record<string, unknown>;
  return {
    firstName: cleanText(body.firstName, 80),
    lastName: cleanText(body.lastName, 80),
    email: cleanText(body.email, 200),
    company: cleanText(body.company, 160),
    street: cleanText(body.street, 160),
    addressExtra: cleanText(body.addressExtra, 160),
    zip: cleanText(body.zip, 10),
    city: cleanText(body.city, 100),
    country: cleanText(body.country, 2).toUpperCase() || 'DE',
    phone: cleanText(body.phone, 60),
    paymentMethod: cleanText(body.paymentMethod, 40),
    shippingMethod: cleanText(body.shippingMethod, 40),
    shippingOptions: selectedIds(body.shippingOptions),
    customerNote: cleanText(body.customerNote, 1000),
    consent: body.consent === '1' || body.consent === 'on' ? '1' : '',
  } as CheckoutForm;
}

function checkoutContext(form: Partial<CheckoutForm>, lines: CartLine[]) {
  const subtotal = subtotalCents(lines);
  const shipping = getPricingConfig().shipping;
  const options = shippingOptions(subtotal, lines);
  const selected = options.find((option) => option.id === form.shippingMethod) ?? options[0];
  const addons = availableShippingAddons(shipping, lines);
  const chosenAddonIds = form.shippingOptions ?? [];
  const selectedAddons = addons.filter((addon) => chosenAddonIds.includes(addon.id));
  const extras = addonCents(selectedAddons);
  return {
    form,
    lines,
    subtotalCents: subtotal,
    shippingOptions: options,
    selectedShippingCents: selected?.cents ?? 0,
    selectedShipping: selected
      ? { id: selected.id, label: selected.label, deliveryDays: selected.deliveryDays, cents: selected.cents }
      : null,
    shippingAddons: addons.map((addon) => ({ ...addon, cents: Math.round(addon.price * 100) })),
    selectedAddonIds: selectedAddons.map((addon) => addon.id),
    optionsCents: extras,
    totalCents: subtotal + (selected?.cents ?? 0) + extras,
    paymentMethods: getPublicPaymentMethods(),
    countries: config.shop.checkout.acceptedCountries,
  };
}

function orderNumber(): string {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const number = `B-${year}-${createReference('B').slice(2)}`;
    const exists = db().prepare('SELECT 1 FROM orders WHERE order_number = ?').get(number);
    if (!exists) return number;
  }
  throw new Error('Bestellnummer konnte nicht erzeugt werden.');
}

function cartLineLabel(line: CartLine): string {
  return [
    line.variantLabel,
    line.color ? `Farbe: ${line.color}` : '',
    line.personalization ? `Personalisierung: ${line.personalization}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function orderMailText(
  number: string,
  form: CheckoutForm,
  lines: CartLine[],
  totals: ReturnType<typeof orderTotals>,
  paymentLabel: string,
  paymentProvider: string,
  shippingLabel: string,
  addons: ShippingAddon[],
  orderUrl: string,
): string {
  return [
    `Bestellung ${number}`,
    '',
    `${form.firstName} ${form.lastName}`,
    form.company ? `Firma: ${form.company}` : '',
    `${form.street}${form.addressExtra ? `, ${form.addressExtra}` : ''}`,
    `${form.zip} ${form.city}`,
    form.country,
    `E-Mail: ${form.email}`,
    `Telefon: ${form.phone || '–'}`,
    '',
    'Positionen:',
    ...lines.map(
      (line) =>
        `- ${line.quantity} × ${line.productName}${cartLineLabel(line) ? ` (${cartLineLabel(line)})` : ''} à ${formatEuro(line.unitPriceCents)} = ${formatEuro(line.lineTotalCents)}`,
    ),
    '',
    `Zwischensumme: ${formatEuro(totals.subtotalCents)}`,
    `Versand (${shippingLabel}): ${totals.shippingCents === 0 ? 'kostenlos' : formatEuro(totals.shippingCents)}`,
    ...(addons.length > 0
      ? addons.map((addon) => `Option: ${addon.label} (+ ${formatEuro(Math.round(addon.price * 100))})`)
      : []),
    `Gesamt: ${formatEuro(totals.totalCents)}`,
    '',
    `Zahlungsart: ${paymentLabel}`,
    `Zahlungsanbieter: ${paymentProvider}`,
    `Zahlungsstatus: offen`,
    `Versandart: ${shippingLabel}`,
    form.customerNote ? `Anmerkung: ${form.customerNote}` : '',
    '',
    `Bestellübersicht: ${orderUrl}`,
    '',
    config.site.business.vatNote,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function customerOrderMailText(
  number: string,
  form: CheckoutForm,
  lines: CartLine[],
  totals: ReturnType<typeof orderTotals>,
  paymentProvider: string,
  paymentLabel: string,
  shippingLabel: string,
  addons: ShippingAddon[],
  bank: BankDetails,
  bankConfigured: boolean,
  orderUrl: string,
  paymentUrl: string,
): string {
  const paymentLines =
    paymentProvider === 'manual'
      ? [
          bankConfigured
            ? `Bitte überweisen Sie ${formatEuro(totals.totalCents)} auf folgendes Konto:`
            : `Bitte überweisen Sie ${formatEuro(totals.totalCents)} auf unsere Bankverbindung. Die Bankverbindung wird Ihnen in einer separaten E-Mail mitgeteilt.`,
          ...(bankConfigured
            ? [
                `Kontoinhaber: ${bank.accountHolder}`,
                `IBAN: ${bank.iban}`,
                ...(bank.bic ? [`BIC: ${bank.bic}`] : []),
                ...(bank.bankName ? [`Bank: ${bank.bankName}`] : []),
                `Verwendungszweck: ${number}`,
              ]
            : []),
          '',
          'Die Bestellung wird nach Zahlungseingang gefertigt bzw. versandt.',
        ]
      : [
          'Die Zahlung wird über unseren Zahlungsdienstleister Stripe abgewickelt.',
          'Sie werden nach der Bestellung zur Zahlung weitergeleitet.',
          '',
          'Falls die Zahlung nicht abgeschlossen wurde, können Sie sie hier erneut starten:',
          paymentUrl,
          '',
          'Bestellübersicht:',
          orderUrl,
        ];

  return [
    `Hallo ${form.firstName},`,
    '',
    'vielen Dank für Ihre Bestellung. Wir haben folgende Angaben erhalten:',
    '',
    `Bestellnummer: ${number}`,
    ...lines.map(
      (line) =>
        `- ${line.quantity} × ${line.productName}${cartLineLabel(line) ? ` (${cartLineLabel(line)})` : ''} = ${formatEuro(line.lineTotalCents)}`,
    ),
    '',
    `Zwischensumme: ${formatEuro(totals.subtotalCents)}`,
    `Versand: ${totals.shippingCents === 0 ? 'kostenlos' : formatEuro(totals.shippingCents)}`,
    ...(addons.length > 0
      ? addons.map((addon) => `Option: ${addon.label} (+ ${formatEuro(Math.round(addon.price * 100))})`)
      : []),
    `Gesamt: ${formatEuro(totals.totalCents)}`,
    '',
    `Zahlungsart: ${paymentLabel}`,
    `Versandart: ${shippingLabel}`,
    '',
    ...paymentLines,
    '',
    `Bestellübersicht: ${orderUrl}`,
    `AGB: ${config.payment.baseUrl}/agb/`,
    `Widerrufsbelehrung: ${config.payment.baseUrl}/widerruf/`,
    `Muster-Widerrufsformular (PDF): ${config.payment.baseUrl}/widerruf/formular.pdf`,
    '',
    'Viele Grüße',
    '3D-MIR 3D-Druck Service',
  ].join('\n');
}

function orderAccess(query: Record<string, unknown>): { number: string; token: string } | null {
  const number = typeof query.nummer === 'string' ? query.nummer : '';
  const token = typeof query.token === 'string' ? query.token : '';
  if (!/^B-\d{4}-[A-Z2-9]{5}$/.test(number)) return null;
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  return { number, token };
}

function localOrderUrl(order: Pick<PaymentOrder, 'order_number' | 'public_token'>): string {
  return `/bestellung/danke/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;
}

function localRetryUrl(order: Pick<PaymentOrder, 'order_number' | 'public_token'>): string {
  return `/bestellung/zahlung/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;
}

function publicRetryUrl(order: Pick<PaymentOrder, 'order_number' | 'public_token'>): string {
  return `${config.payment.baseUrl}/bestellung/zahlung/?nummer=${encodeURIComponent(order.order_number)}&token=${order.public_token}`;
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------

export async function shopRoutes(app: FastifyInstance): Promise<void> {
  app.get('/shop/', async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const requestedSlug = typeof query.kategorie === 'string' ? query.kategorie : '';
    const activeCategory = requestedSlug ? findCategoryBySlug(requestedSlug) : undefined;
    render(reply, 'pages/shop.njk', {
      products: listProducts(activeCategory?.slug),
      categories: allCategories(),
      activeCategory: activeCategory ?? null,
    });
  });

  app.get<{ Params: { slug: string } }>('/shop/:slug/', async (request, reply) => {
    const found = findProduct(request.params.slug);
    if (!found) return shopError(reply, 404, 'Dieses Produkt wurde nicht gefunden.');
    const { product, variants, images } = found;
    const prices = variants.map((variant) => variant.price_cents);
    const minPrice = prices.length > 0 ? Math.min(...prices) : product.price_from_cents;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : product.price_from_cents;
    const shipping = getPricingConfig().shipping;
    const assignedMethods = parseIdList(product.shipping_method_ids);
    const activeMethods = shipping.methods.filter((method) => method.active !== false);
    const allowedMethods = assignedMethods.length > 0
      ? activeMethods.filter((method) => assignedMethods.includes(method.id))
      : activeMethods;
    const productShippingMethods = allowedMethods.length > 0 ? allowedMethods : activeMethods;
    // Abholung (0 €) mitzählen: Dann beginnt der Versand bei 0 €.
    const shippingPrices = productShippingMethods.map((method) => method.price);
    render(reply, 'pages/produkt.njk', {
      product,
      variants,
      images,
      colorOptions: productColors(product),
      personalizationEnabled: product.personalization_enabled === 1,
      productJsonLd: productJsonLd(product, variants),
      maxQuantity: config.shop.maxQuantityPerItem,
      shipping,
      productShippingMethods,
      shippingFromPrice: shippingPrices.length > 0 ? Math.min(...shippingPrices) : null,
      basePriceText: maxPrice > minPrice ? `ab ${formatEuro(minPrice)}` : formatEuro(minPrice),
      categories: categoriesForProduct(product.id),
    });
  });

  app.post('/warenkorb/hinzufuegen/', async (request, reply) => {
    if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const productId = Math.trunc(Number(body.productId));
    const found = Number.isFinite(productId) ? findProductById(productId) : null;
    if (!found) {
      return shopError(reply, 400, 'Dieses Produkt ist nicht mehr verfügbar.');
    }
    const { product, variants } = found;

    let variant: VariantRow | null = null;
    if (variants.length > 0) {
      const variantId = Math.trunc(Number(body.variantId));
      variant = Number.isFinite(variantId) ? variants.find((item) => item.id === variantId) ?? null : null;
      if (!variant) return shopError(reply, 400, 'Bitte wählen Sie eine gültige Variante.');
    }

    const colors = productColors(product);
    let color = '';
    if (colors.length > 0) {
      color = matchColor(colors, cleanText(body.color, 60)) ?? '';
      if (!color) return shopError(reply, 400, 'Bitte wählen Sie eine gültige Farbe.');
    }
    const personalization = product.personalization_enabled === 1 ? cleanText(body.personalization, 500) : '';

    const quantity = Math.min(
      config.shop.maxQuantityPerItem,
      Math.max(1, Math.trunc(Number(body.quantity ?? 1)) || 1),
    );
    const item = {
      productId: product.id,
      variantId: variant ? variant.id : null,
      color,
      personalization,
      quantity,
    };

    const cart = readCart(request);
    const key = cartLineKey(item);
    const existing = cart.items.find((entry) => cartLineKey(entry) === key);
    if (existing) {
      existing.quantity = Math.min(config.shop.maxQuantityPerItem, existing.quantity + quantity);
    } else {
      cart.items.push(item);
    }
    writeCart(reply, cart, secureCookie(request));
    request.log.info({ productId: product.id, variantId: item.variantId, color, quantity }, 'Artikel in den Warenkorb gelegt');
    return reply.redirect('/warenkorb/', 303);
  });

  app.get('/warenkorb/', async (request, reply) => {
    const lines = loadCartLines(readCart(request));
    const subtotal = subtotalCents(lines);
    render(reply, 'pages/warenkorb.njk', {
      lines,
      subtotalCents: subtotal,
      shippingOptions: shippingOptions(subtotal, lines),
      maxQuantity: config.shop.maxQuantityPerItem,
      freeShippingFrom: getPricingConfig().shipping.freeShippingFrom,
    });
  });

  app.post('/warenkorb/aktualisieren/', async (request, reply) => {
    if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const cart = readCart(request);
    for (const item of cart.items) {
      const key = cartLineKey(item);
      const raw = body[`quantity_${key}`];
      if (raw === undefined) continue;
      const quantity = Math.trunc(Number(raw));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        item.quantity = 0;
      } else {
        item.quantity = Math.min(config.shop.maxQuantityPerItem, quantity);
      }
    }
    cart.items = cart.items.filter((item) => item.quantity > 0);
    writeCart(reply, cart, secureCookie(request));
    return reply.redirect('/warenkorb/', 303);
  });

  app.post('/warenkorb/entfernen/', async (request, reply) => {
    if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const key = cleanText(body.key, 64);
    const cart = readCart(request);
    cart.items = cart.items.filter((item) => cartLineKey(item) !== key);
    writeCart(reply, cart, secureCookie(request));
    return reply.redirect('/warenkorb/', 303);
  });

  app.get('/kasse/', async (request, reply) => {
    const lines = loadCartLines(readCart(request));
    if (lines.length === 0) return reply.redirect('/warenkorb/', 303);
    render(reply, 'pages/kasse.njk', {
      ...checkoutContext({ country: 'DE' }, lines),
    });
  });

  app.post(
    '/kasse/',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;

      // Honeypot: Bots bekommen eine neutrale Bestätigung ohne Bestellung.
      if (cleanText(body.website, 100)) {
        request.log.warn({ ip: request.ip }, 'Kasse: Honeypot ausgelöst');
        return reply.redirect('/bestellung/danke/', 303);
      }

      const lines = loadCartLines(readCart(request));
      if (lines.length === 0) return reply.redirect('/warenkorb/', 303);

      const form = readCheckoutForm(request);
      const fail = (message: string, status = 400) => {
        reply.code(status);
        return render(reply, 'pages/kasse.njk', {
          ...checkoutContext(form, lines),
          error: message,
        });
      };

      if (!isSameOrigin(request)) {
        return fail('Die Anfrage konnte nicht zugeordnet werden. Bitte laden Sie die Seite neu.', 403);
      }

      const parsed = checkoutSchema.safeParse(form);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Bitte prüfen Sie Ihre Angaben.');

      const data = parsed.data;
      if (!config.shop.checkout.acceptedCountries.includes(data.country)) {
        return fail('Wir liefern derzeit nur innerhalb Deutschlands. Bitte wählen Sie ein anderes Lieferland oder kontaktieren Sie uns.');
      }

      const pricing = getPricingConfig();
      const allowedMethods = availableShippingMethods(pricing.shipping, lines);
      const shippingMethod = allowedMethods.find((method) => method.id === data.shippingMethod) ?? null;
      if (!shippingMethod) return fail('Bitte wählen Sie eine für diese Produkte verfügbare Versandart.');
      const paymentMethod = findCheckoutPaymentMethod(data.paymentMethod);
      if (!paymentMethod) return fail('Bitte wählen Sie eine gültige Zahlungsart.');

      const allowedAddons = availableShippingAddons(pricing.shipping, lines);
      const allowedAddonIds = new Set(allowedAddons.map((addon) => addon.id));
      if (data.shippingOptions.some((id) => !allowedAddonIds.has(id))) {
        return fail('Bitte prüfen Sie die gewählten Versandoptionen.');
      }
      const selectedAddons = allowedAddons.filter((addon) => data.shippingOptions.includes(addon.id));

      const totals = orderTotals(lines, pricing.shipping, shippingMethod, addonCents(selectedAddons));

      for (const line of lines) {
        if (line.stock != null && line.stock < line.quantity) {
          return fail(
            `Von „${line.productName}“${line.variantLabel ? ` in ${line.variantLabel}` : ''} sind nur noch ${line.stock} Stück verfügbar. Bitte passen Sie die Menge im Warenkorb an.`,
          );
        }
      }

      let number: string;
      let orderId = 0;
      const publicToken = crypto.randomBytes(16).toString('hex');
      const stockReserved = lines.some((line) => line.stock != null) ? 1 : 0;
      try {
        number = orderNumber();
        const createOrder = db().transaction(() => {
          const result = db()
            .prepare(
              `INSERT INTO orders
                (order_number, status, email, first_name, last_name, company, street, address_extra, zip, city,
                 country, phone, payment_method, shipping_method, shipping_cents, options_cents, subtotal_cents,
                 total_cents, customer_note, payment_status, payment_provider, public_token, stock_reserved)
               VALUES (?, 'neu', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?)`,
            )
            .run(
              number,
              data.email,
              data.firstName,
              data.lastName,
              data.company,
              data.street,
              data.addressExtra,
              data.zip,
              data.city,
              data.country,
              data.phone,
              data.paymentMethod,
              data.shippingMethod,
              totals.shippingCents,
              totals.optionsCents,
              totals.subtotalCents,
              totals.totalCents,
              data.customerNote,
              paymentMethod.provider,
              publicToken,
              stockReserved,
            );
          const createdId = Number(result.lastInsertRowid);
          const insertOption = db().prepare(
            'INSERT INTO order_options (order_id, option_id, label, price_cents) VALUES (?, ?, ?, ?)',
          );
          for (const addon of selectedAddons) {
            insertOption.run(createdId, addon.id, addon.label, Math.round(addon.price * 100));
          }
          const insertItem = db().prepare(
            `INSERT INTO order_items
               (order_id, product_id, variant_id, name, variant, color, personalization, unit_price_cents, quantity, line_total_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          );
          for (const line of lines) {
            insertItem.run(
              createdId,
              line.productId,
              line.variantId,
              line.productName,
              line.variantLabel,
              line.color,
              line.personalization,
              line.unitPriceCents,
              line.quantity,
              line.lineTotalCents,
            );
            if (line.stock != null) {
              const reserved = line.variantId === null
                ? db()
                    .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
                    .run(line.quantity, line.productId, line.quantity)
                : db()
                    .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
                    .run(line.quantity, line.variantId, line.quantity);
              if (reserved.changes === 0) {
                throw new Error(`Bestand für ${line.productName} reicht nicht aus.`);
              }
            }
          }
          return createdId;
        });
        orderId = createOrder();
      } catch (error) {
        request.log.error({ err: error }, 'Bestellung konnte nicht gespeichert werden');
        return fail('Die Bestellung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns.');
      }

      const order = getPaymentOrderById(orderId);
      if (!order) {
        return fail('Die Bestellung konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
      }

      const bank = getBankDetails();
      const bankReady = isBankConfigured(bank);
      const orderUrl = publicOrderUrl(order);

      const sendOrderMails = async (): Promise<void> => {
        const paymentUrl = paymentMethod.provider === 'stripe' ? publicRetryUrl(order) : '';
        const itemRows = lines.map(
          (line) => [`${line.quantity} × ${line.productName}`, `${cartLineLabel(line) ? `${cartLineLabel(line)} · ` : ''}${formatEuro(line.lineTotalCents)}`] as [string, string],
        );
        const totalRows: [string, string][] = [
          ['Zwischensumme', formatEuro(totals.subtotalCents)],
          [`Versand (${shippingMethod.label})`, totals.shippingCents === 0 ? 'kostenlos' : formatEuro(totals.shippingCents)],
          ...(selectedAddons.length > 0
            ? selectedAddons.map((addon) => [addon.label, `+ ${formatEuro(Math.round(addon.price * 100))}`] as [string, string])
            : []),
          ['Gesamt', formatEuro(totals.totalCents)],
        ];
        const customerPaymentHtml =
          paymentMethod.provider === 'manual'
            ? `${mailNotice(bankReady ? `Bitte überweisen Sie ${formatEuro(totals.totalCents)} auf das unten genannte Konto.` : `Bitte überweisen Sie ${formatEuro(totals.totalCents)} auf unsere Bankverbindung. Die Bankverbindung wird Ihnen in einer separaten E-Mail mitgeteilt.`)}${bankReady ? mailTable([
                ['Kontoinhaber', bank.accountHolder],
                ['IBAN', bank.iban],
                ...(bank.bic ? [['BIC', bank.bic] as [string, string]] : []),
                ...(bank.bankName ? [['Bank', bank.bankName] as [string, string]] : []),
                ['Verwendungszweck', number],
              ]) : ''}`
            : `${mailNotice('Die Zahlung wird über unseren Zahlungsdienstleister Stripe abgewickelt.')}${paymentUrl ? mailButton(paymentUrl, 'Zahlung starten') : ''}`;

        const adminHtml = mailLayout({
          title: `Neue Bestellung ${number}`,
          preheader: `${data.firstName} ${data.lastName} · ${formatEuro(totals.totalCents)}`,
          body: [
            mailSection('Kunde', mailTable([
              ['Name', `${data.firstName} ${data.lastName}`],
              ['E-Mail', data.email],
              ['Telefon', data.phone || '–'],
              ['Firma', data.company || '–'],
            ])),
            mailSection('Lieferadresse', mailParagraph(`${data.street}${data.addressExtra ? `, ${data.addressExtra}` : ''}\n${data.zip} ${data.city}\n${data.country}`)),
            mailSection('Positionen', mailTable(itemRows)),
            mailSection('Summe', mailTable(totalRows)),
            mailSection('Zahlung und Versand', mailTable([
              ['Zahlungsart', paymentMethod.label],
              ['Zahlungsstatus', 'offen'],
              ['Versandart', shippingMethod.label],
            ])),
            ...(data.customerNote ? [mailSection('Anmerkung', mailParagraph(data.customerNote))] : []),
            mailButton(`${config.site.baseUrl}/admin/bestellungen/${order.id}/`, 'Bestellung im Admin öffnen'),
          ].join(''),
        });

        const customerHtml = mailLayout({
          title: `Ihre Bestellung ${number}`,
          preheader: 'Vielen Dank für Ihre Bestellung bei 3D-MIR.',
          body: [
            mailParagraph(`Hallo ${data.firstName},`),
            mailParagraph('vielen Dank für Ihre Bestellung. Wir haben folgende Angaben erhalten:'),
            mailSection('Ihre Positionen', mailTable(itemRows)),
            mailSection('Summe', mailTable(totalRows)),
            mailSection('Zahlung', customerPaymentHtml),
            mailSection('Versand', mailTable([['Versandart', shippingMethod.label]])),
            ...(data.customerNote ? [mailSection('Ihre Anmerkung', mailParagraph(data.customerNote))] : []),
            mailSection('Rechtliche Informationen', `<p style="margin:0;font-size:13px;line-height:1.7;">${mailLink(`${config.payment.baseUrl}/agb/`, 'AGB')}<br>${mailLink(`${config.payment.baseUrl}/widerruf/`, 'Widerrufsbelehrung')}<br>${mailLink(`${config.payment.baseUrl}/widerruf/formular.pdf`, 'Muster-Widerrufsformular (PDF)')}</p>`),
            mailParagraph(config.site.business.vatNote),
            mailButton(orderUrl, 'Bestellübersicht öffnen'),
          ].join(''),
        });

        try {
          await notifyAdmin({
            event: 'order_new',
            subject: `[Bestellung ${number}] ${lines.length} Position(en), ${formatEuro(totals.totalCents)}`,
            text: orderMailText(
              number,
              data,
              lines,
              totals,
              paymentMethod.label,
              paymentMethod.provider,
              shippingMethod.label,
              selectedAddons,
              orderUrl,
            ),
            html: adminHtml,
            replyTo: data.email,
          });
          await sendMail({
            to: data.email,
            subject: `Ihre Bestellung ${number} bei 3D-MIR`,
            text: customerOrderMailText(
              number,
              data,
              lines,
              totals,
              paymentMethod.provider,
              paymentMethod.label,
              shippingMethod.label,
              selectedAddons,
              bank,
              bankReady,
              orderUrl,
              paymentUrl,
            ),
            html: customerHtml,
            replyTo: config.mail.to,
          });
        } catch (error) {
          request.log.error({ err: error, number }, 'Bestellung gespeichert, aber E-Mail-Versand fehlgeschlagen');
        }
      };

      if (paymentMethod.provider === 'stripe') {
        try {
          const payment = await createPaymentForOrder(order);
          clearCart(reply);
          await sendOrderMails();
          request.log.info(
            { number, totalCents: totals.totalCents, provider: 'stripe' },
            'Bestellung angelegt und Zahlung gestartet',
          );
          if (!payment.redirectUrl) throw new Error('Stripe hat keine Zahlungs-URL geliefert.');
          return reply.redirect(payment.redirectUrl, 303);
        } catch (error) {
          request.log.error({ err: error, number }, 'Online-Zahlung konnte nicht gestartet werden');
          markOrderPaymentFailed(order.id, 'stripe', '', 'Die Online-Zahlung konnte nicht gestartet werden.');
          releaseStock(order.id, 'Online-Zahlung konnte nicht gestartet werden');
          return fail(
            'Die Online-Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut oder wählen Sie die Zahlung per Vorkasse.',
          );
        }
      }

      clearCart(reply);
      await sendOrderMails();
      request.log.info(
        { number, totalCents: totals.totalCents, provider: paymentMethod.provider },
        'Bestellung angelegt',
      );
      return reply.redirect(
        `/bestellung/danke/?nummer=${encodeURIComponent(number)}&token=${publicToken}`,
        303,
      );
    },
  );

  app.get('/bestellung/danke/', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const access = orderAccess(query);
    let order = access ? getPaymentOrderByAccess(access.number, access.token) : null;

    const sessionId = typeof query.session_id === 'string' ? query.session_id : '';
    if (
      order &&
      sessionId &&
      /^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId) &&
      order.payment_provider === 'stripe' &&
      order.payment_status !== 'bezahlt'
    ) {
      try {
        await reconcileStripeSession(sessionId);
        order = getPaymentOrderByAccess(access!.number, access!.token);
      } catch (error) {
        request.log.warn({ err: error, order: access?.number }, 'Stripe-Rückleitung konnte nicht geprüft werden');
      }
    }

    const items = order ? getOrderItems(order.id) : [];
    const options = order ? getOrderOptions(order.id) : [];
    const paymentMethod = order ? findPaymentMethod(order.payment_method) : null;

    render(reply, 'pages/bestellung-danke.njk', {
      number: order ? order.order_number : null,
      order,
      items,
      options,
      paymentMethod,
      paymentStatusText: order ? paymentStatusLabel(order.payment_status) : '',
      paymentStatusTone: order ? paymentStatusTone(order.payment_status) : 'neutral',
      token: order?.public_token ?? '',
      retryUrl: order ? localRetryUrl(order) : '',
      refreshUrl: order ? localOrderUrl(order) : '',
    });
  });

  app.get('/bestellung/zahlung/', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const access = orderAccess(query);
    const order = access ? getPaymentOrderByAccess(access.number, access.token) : null;
    if (!order) return shopError(reply, 404, 'Diese Bestellung wurde nicht gefunden.');

    if (order.payment_status === 'bezahlt') {
      return reply.redirect(localOrderUrl(order), 303);
    }
    if (order.status === 'storniert' || order.stock_released_at) {
      return shopError(reply, 409, 'Diese Bestellung ist nicht mehr aktiv. Bitte legen Sie die Artikel erneut in den Warenkorb.');
    }

    const paymentMethod = findPaymentMethod(order.payment_method);
    if (!paymentMethod || paymentMethod.provider === 'manual') {
      return reply.redirect(localOrderUrl(order), 303);
    }

    render(reply, 'pages/bestellung-zahlung.njk', {
      order,
      paymentMethod,
      token: order.public_token,
      error: null,
    });
  });

  app.post(
    '/bestellung/zahlung/',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
      const body = (request.body ?? {}) as Record<string, unknown>;
      const access = orderAccess(body);
      const order = access ? getPaymentOrderByAccess(access.number, access.token) : null;
      if (!order) return shopError(reply, 404, 'Diese Bestellung wurde nicht gefunden.');

      if (order.payment_status === 'bezahlt') {
        return reply.redirect(localOrderUrl(order), 303);
      }
      if (order.status === 'storniert' || order.stock_released_at) {
        return shopError(reply, 409, 'Diese Bestellung ist nicht mehr aktiv. Bitte legen Sie die Artikel erneut in den Warenkorb.');
      }

      const paymentMethod = findPaymentMethod(order.payment_method);
      if (!paymentMethod || paymentMethod.provider === 'manual') {
        return reply.redirect(localOrderUrl(order), 303);
      }

      try {
        const payment = await createPaymentForOrder(order);
        if (!payment.redirectUrl) throw new Error('Stripe hat keine Zahlungs-URL geliefert.');
        return reply.redirect(payment.redirectUrl, 303);
      } catch (error) {
        request.log.error({ err: error, order: order.order_number }, 'Zahlung konnte nicht erneut gestartet werden');
        reply.code(400);
        return render(reply, 'pages/bestellung-zahlung.njk', {
          order,
          paymentMethod,
          token: order.public_token,
          error: 'Die Zahlung konnte nicht erneut gestartet werden. Bitte versuchen Sie es später noch einmal oder wählen Sie Vorkasse.',
        });
      }
    },
  );

}
