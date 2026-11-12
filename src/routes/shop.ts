import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { sendMail } from '../lib/mailer.js';
import { cleanText, createReference, isSameOrigin } from '../lib/http.js';
import { clearCart, readCart, writeCart, type Cart } from '../lib/cart.js';
import {
  findShippingMethod,
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

type ProductListItem = ProductRow & { image: string | null };

type CartLine = {
  variantId: number;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  variantLabel: string;
  productId: number;
  productSlug: string;
  productName: string;
  stock: number | null;
};

type ShippingOption = ShippingMethod & { cents: number; free: boolean };

const db = () => getDb();

function listProducts(): ProductListItem[] {
  return db()
    .prepare(
      `SELECT p.*, (
         SELECT file FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1
       ) AS image
       FROM products p
       WHERE p.active = 1
       ORDER BY p.sort_order, p.name`,
    )
    .all() as ProductListItem[];
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

function findVariant(variantId: number): (VariantRow & { product_slug: string; product_name: string; product_active: number }) | null {
  const row = db()
    .prepare(
      `SELECT v.*, p.slug AS product_slug, p.name AS product_name, p.active AS product_active
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ?`,
    )
    .get(variantId) as
    | (VariantRow & { product_slug: string; product_name: string; product_active: number })
    | undefined;
  return row ?? null;
}

/** Löst den Cookie-Warenkorb gegen die Datenbank auf. Preise kommen nie aus dem Cookie. */
function loadCartLines(cart: Cart): CartLine[] {
  if (cart.items.length === 0) return [];
  const ids = cart.items.map((item) => item.variantId);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db()
    .prepare(
      `SELECT v.id, v.label, v.price_cents, v.stock, p.id AS product_id, p.slug, p.name
       FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE p.active = 1 AND v.id IN (${placeholders})`,
    )
    .all(...ids) as {
    id: number;
    label: string;
    price_cents: number;
    stock: number | null;
    product_id: number;
    slug: string;
    name: string;
  }[];

  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines: CartLine[] = [];
  for (const item of cart.items) {
    const row = byId.get(item.variantId);
    if (!row) continue;
    const quantity = Math.min(config.shop.maxQuantityPerItem, Math.max(1, item.quantity));
    lines.push({
      variantId: row.id,
      quantity,
      unitPriceCents: row.price_cents,
      lineTotalCents: row.price_cents * quantity,
      variantLabel: row.label,
      productId: row.product_id,
      productSlug: row.slug,
      productName: row.name,
      stock: row.stock,
    });
  }
  return lines;
}

function shippingOptions(subtotal: number): ShippingOption[] {
  return config.pricing.shipping.methods.map((method) => {
    const cents = shippingCents(config.pricing.shipping, method, subtotal);
    return { ...method, cents, free: cents === 0 && method.price > 0 };
  });
}

function productJsonLd(product: ProductRow, variants: VariantRow[]) {
  const prices = variants.map((variant) => variant.price_cents);
  const low = prices.length > 0 ? Math.min(...prices) : product.price_from_cents;
  const high = Math.max(
    ...prices,
    product.price_to_cents ?? 0,
    product.price_from_cents,
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description,
    sku: product.sku ?? undefined,
    image: [`${config.site.baseUrl}/assets/img/gen/product-battery-box-900.jpg`],
    brand: { '@type': 'Brand', name: config.site.business.name },
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
  };
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
  customerNote: z.string().max(1000),
  consent: z.literal('1', {
    errorMap: () => ({ message: 'Bitte akzeptieren Sie AGB und Widerrufsbelehrung.' }),
  }),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

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
    customerNote: cleanText(body.customerNote, 1000),
    consent: body.consent === '1' || body.consent === 'on' ? '1' : '',
  } as CheckoutForm;
}

function checkoutContext(form: Partial<CheckoutForm>, lines: CartLine[]) {
  const subtotal = subtotalCents(lines);
  const options = shippingOptions(subtotal);
  const selected = options.find((option) => option.id === form.shippingMethod) ?? options[0];
  return {
    form,
    lines,
    subtotalCents: subtotal,
    shippingOptions: options,
    selectedShippingCents: selected?.cents ?? 0,
    totalCents: subtotal + (selected?.cents ?? 0),
    paymentMethods: config.shop.payment.methods,
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

function orderMailText(
  number: string,
  form: CheckoutForm,
  lines: CartLine[],
  totals: ReturnType<typeof orderTotals>,
  paymentLabel: string,
  shippingLabel: string,
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
        `- ${line.quantity} × ${line.productName} (${line.variantLabel}) à ${formatEuro(line.unitPriceCents)} = ${formatEuro(line.lineTotalCents)}`,
    ),
    '',
    `Zwischensumme: ${formatEuro(totals.subtotalCents)}`,
    `Versand (${shippingLabel}): ${totals.shippingCents === 0 ? 'kostenlos' : formatEuro(totals.shippingCents)}`,
    `Gesamt: ${formatEuro(totals.totalCents)}`,
    '',
    `Zahlungsart: ${paymentLabel}`,
    `Versandart: ${shippingLabel}`,
    form.customerNote ? `Anmerkung: ${form.customerNote}` : '',
    '',
    config.site.business.vatNote,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ---------------------------------------------------------------------------
// Routen
// ---------------------------------------------------------------------------

export async function shopRoutes(app: FastifyInstance): Promise<void> {
  app.get('/shop/', async (_request, reply) => {
    render(reply, 'pages/shop.njk', {
      products: listProducts(),
    });
  });

  app.get<{ Params: { slug: string } }>('/shop/:slug/', async (request, reply) => {
    const found = findProduct(request.params.slug);
    if (!found) return shopError(reply, 404, 'Dieses Produkt wurde nicht gefunden.');
    const { product, variants, images } = found;
    render(reply, 'pages/produkt.njk', {
      product,
      variants,
      images,
      productJsonLd: productJsonLd(product, variants),
      maxQuantity: config.shop.maxQuantityPerItem,
      shipping: config.pricing.shipping,
    });
  });

  app.post('/warenkorb/hinzufuegen/', async (request, reply) => {
    if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const variantId = Math.trunc(Number(body.variantId));
    const quantity = Math.min(
      config.shop.maxQuantityPerItem,
      Math.max(1, Math.trunc(Number(body.quantity ?? 1)) || 1),
    );
    const variant = Number.isFinite(variantId) ? findVariant(variantId) : null;
    if (!variant || variant.product_active !== 1) {
      return shopError(reply, 400, 'Bitte wählen Sie eine gültige Farbvariante.');
    }

    const cart = readCart(request);
    const existing = cart.items.find((item) => item.variantId === variantId);
    if (existing) {
      existing.quantity = Math.min(config.shop.maxQuantityPerItem, existing.quantity + quantity);
    } else {
      cart.items.push({ variantId, quantity });
    }
    writeCart(reply, cart, secureCookie(request));
    request.log.info({ variantId, quantity }, 'Artikel in den Warenkorb gelegt');
    return reply.redirect('/warenkorb/', 303);
  });

  app.get('/warenkorb/', async (request, reply) => {
    const lines = loadCartLines(readCart(request));
    const subtotal = subtotalCents(lines);
    render(reply, 'pages/warenkorb.njk', {
      lines,
      subtotalCents: subtotal,
      shippingOptions: shippingOptions(subtotal),
      maxQuantity: config.shop.maxQuantityPerItem,
      freeShippingFrom: config.pricing.shipping.freeShippingFrom,
    });
  });

  app.post('/warenkorb/aktualisieren/', async (request, reply) => {
    if (!isSameOrigin(request)) return shopError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    const cart = readCart(request);
    for (const item of cart.items) {
      const raw = body[`quantity_${item.variantId}`];
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
    const variantId = Math.trunc(Number(body.variantId));
    const cart = readCart(request);
    cart.items = cart.items.filter((item) => item.variantId !== variantId);
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

      const shippingMethod = findShippingMethod(config.pricing.shipping, data.shippingMethod);
      if (!shippingMethod) return fail('Bitte wählen Sie eine gültige Versandart.');
      const paymentMethod = config.shop.payment.methods.find((method) => method.id === data.paymentMethod);
      if (!paymentMethod) return fail('Bitte wählen Sie eine gültige Zahlungsart.');

      const totals = orderTotals(lines, config.pricing.shipping, shippingMethod);

      for (const line of lines) {
        if (line.stock != null && line.stock < line.quantity) {
          return fail(
            `Von „${line.productName}“ in ${line.variantLabel} sind nur noch ${line.stock} Stück verfügbar. Bitte passen Sie die Menge im Warenkorb an.`,
          );
        }
      }

      let number: string;
      try {
        number = orderNumber();
        const createOrder = db().transaction(() => {
          const result = db()
            .prepare(
              `INSERT INTO orders
                (order_number, status, email, first_name, last_name, company, street, address_extra, zip, city,
                 country, phone, payment_method, shipping_method, shipping_cents, subtotal_cents, total_cents, customer_note)
               VALUES (?, 'neu', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              totals.subtotalCents,
              totals.totalCents,
              data.customerNote,
            );
          const orderId = Number(result.lastInsertRowid);
          const insertItem = db().prepare(
            `INSERT INTO order_items (order_id, product_id, name, variant, unit_price_cents, quantity, line_total_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          );
          for (const line of lines) {
            insertItem.run(
              orderId,
              line.productId,
              line.productName,
              line.variantLabel,
              line.unitPriceCents,
              line.quantity,
              line.lineTotalCents,
            );
            if (line.stock != null) {
              db()
                .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
                .run(line.quantity, line.variantId, line.quantity);
            }
          }
        });
        createOrder();
      } catch (error) {
        request.log.error({ err: error }, 'Bestellung konnte nicht gespeichert werden');
        return fail('Die Bestellung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns.');
      }

      clearCart(reply);

      try {
        await sendMail({
          subject: `[Bestellung ${number}] ${lines.length} Position(en), ${formatEuro(totals.totalCents)}`,
          text: orderMailText(number, data, lines, totals, paymentMethod.label, shippingMethod.label),
          replyTo: data.email,
        });
        await sendMail({
          to: data.email,
          subject: `Ihre Bestellung ${number} bei 3D-MIR`,
          text: [
            `Hallo ${data.firstName},`,
            '',
            'vielen Dank für Ihre Bestellung. Wir haben folgende Angaben erhalten:',
            '',
            `Bestellnummer: ${number}`,
            ...lines.map(
              (line) =>
                `- ${line.quantity} × ${line.productName} (${line.variantLabel}) = ${formatEuro(line.lineTotalCents)}`,
            ),
            '',
            `Zwischensumme: ${formatEuro(totals.subtotalCents)}`,
            `Versand: ${totals.shippingCents === 0 ? 'kostenlos' : formatEuro(totals.shippingCents)}`,
            `Gesamt: ${formatEuro(totals.totalCents)}`,
            '',
            `Zahlungsart: ${paymentMethod.label}`,
            paymentMethod.note,
            '',
            'Wir prüfen Ihre Bestellung und melden uns mit den nächsten Schritten.',
            '',
            'Viele Grüße',
            '3D-MIR 3D-Druck Service',
          ].join('\n'),
          replyTo: config.mail.to,
        });
      } catch (error) {
        request.log.error({ err: error, number }, 'Bestellung gespeichert, aber E-Mail-Versand fehlgeschlagen');
      }

      request.log.info({ number, totalCents: totals.totalCents }, 'Bestellung angelegt');
      return reply.redirect(`/bestellung/danke/?nummer=${encodeURIComponent(number)}`, 303);
    },
  );

  app.get('/bestellung/danke/', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const raw = typeof query.nummer === 'string' ? query.nummer : '';
    const number = /^B-\d{4}-[A-Z2-9]{5}$/.test(raw) ? raw : null;
    let order: { order_number: string; total_cents: number; shipping_cents: number; subtotal_cents: number } | null = null;
    let items: { name: string; variant: string; quantity: number; line_total_cents: number }[] = [];
    if (number) {
      order =
        (db()
          .prepare('SELECT order_number, total_cents, shipping_cents, subtotal_cents FROM orders WHERE order_number = ?')
          .get(number) as typeof order) ?? null;
      if (order) {
        items = db()
          .prepare('SELECT name, variant, quantity, line_total_cents FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_number = ?) ORDER BY id')
          .all(number) as typeof items;
      }
    }
    render(reply, 'pages/bestellung-danke.njk', { number: order ? number : null, order, items });
  });
}
