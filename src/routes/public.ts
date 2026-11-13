import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { notifyAdmin } from '../lib/notifications.js';
import { cleanText, escapeHtml, isSameOrigin } from '../lib/http.js';
import { getPricingConfig } from '../lib/pricing-config.js';
import { getPublicPaymentMethods, getShopSettings, isBankConfigured } from '../lib/shop-settings.js';
import { isStripeConfigured } from '../lib/payments/stripe.js';

/** Liest alle Inhaltsblöcke als Schlüssel-Wert-Paare. */
export function getContent(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM content_blocks').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

const icons = {
  prototype:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
  model:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M9 20v-6h6v6"/></svg>',
  series:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  spare:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10.1 3.05V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>',
};

const services = [
  {
    icon: icons.prototype,
    title: 'Prototyping',
    text: 'Schnelle Iterationen für Design, Technik und Produktentwicklung – vom ersten Entwurf bis zur belastbaren Funktionsprobe.',
  },
  {
    icon: icons.model,
    title: 'Modellbau',
    text: 'Präzise Bauteile, Gehäuse und Deko-Objekte. Auch feine Details und mehrteilige Modelle setzen wir sauber um.',
  },
  {
    icon: icons.series,
    title: 'Kleinserien',
    text: 'Wirtschaftliche Stückzahlen ohne Werkzeugkosten. Ideal für Markttests, Vereine, Messebedarf oder Ersatzteile.',
  },
  {
    icon: icons.spare,
    title: 'Ersatzteile',
    text: 'Ob Halter, Abdeckung oder Verbindungsteil: Wir fertigen passgenaue Ersatzteile, wenn das Original nicht mehr lieferbar ist.',
  },
];

/** Drucker inklusive aufgelöster Materialnamen für das Template. */
function getPrinters() {
  const pricing = getPricingConfig();
  return pricing.printers.map((printer) => {
    const labels = printer.materialIds.map(
      (id) => pricing.materials.find((material) => material.id === id)?.label ?? id,
    );
    return { ...printer, materialLabels: labels };
  });
}

/** Lokale Geschäftsdaten als JSON-LD (strukturierte Daten für Suchmaschinen). */
const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: config.site.business.legalName,
  description: config.site.seo.defaultDescription,
  url: config.site.baseUrl,
  image: `${config.site.baseUrl}/assets/img/og-image.jpg`,
  telephone: config.site.business.phone,
  email: config.site.business.email,
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    streetAddress: config.site.business.street,
    postalCode: config.site.business.zip,
    addressLocality: config.site.business.city,
    addressCountry: config.site.business.countryCode,
  },
  areaServed: { '@type': 'Country', name: config.site.business.country },
  sameAs: [config.site.channels.etsy.url, config.site.channels.classifieds.url],
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: config.site.seo.siteName,
  url: config.site.baseUrl,
  inLanguage: 'de-DE',
  publisher: { '@type': 'Organization', name: config.site.business.legalName },
};

const contactSubjects = [
  'Angebot für ein 3D-Modell',
  'Ersatzteil / Nachbau',
  'Kleinserie',
  'Frage zu einer Bestellung',
  'Allgemeine Anfrage',
  'Sonstiges',
] as const;

const contactSchema = z.object({
  name: z.string().min(2, 'Bitte geben Sie Ihren Namen an.').max(120),
  email: z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse an.').max(200),
  phone: z.string().max(60),
  subject: z.enum(contactSubjects),
  message: z
    .string()
    .min(10, 'Bitte beschreiben Sie Ihr Anliegen in mindestens 10 Zeichen.')
    .max(5000, 'Die Nachricht ist zu lang (maximal 5000 Zeichen).'),
  consent: z.literal('1', {
    errorMap: () => ({ message: 'Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.' }),
  }),
});

type ContactForm = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: string;
};

function readContactForm(request: FastifyRequest): ContactForm {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const subject = cleanText(body.subject, 120);
  return {
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 200),
    phone: cleanText(body.phone, 60),
    subject: (contactSubjects as readonly string[]).includes(subject) ? subject : contactSubjects[0],
    message: cleanText(body.message, 5000),
    consent: body.consent === '1' || body.consent === 'on' ? '1' : '',
  };
}

function contactErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Bitte prüfen Sie Ihre Angaben.';
}

function contactMailText(form: ContactForm): string {
  return [
    'Neue Kontaktanfrage über 3d-mir.de',
    '',
    `Name:    ${form.name}`,
    `E-Mail:  ${form.email}`,
    `Telefon: ${form.phone || '–'}`,
    `Anliegen: ${form.subject}`,
    '',
    form.message,
  ].join('\n');
}

function contactMailHtml(form: ContactForm): string {
  const rows = [
    ['Name', form.name],
    ['E-Mail', form.email],
    ['Telefon', form.phone || '–'],
    ['Anliegen', form.subject],
  ]
    .map(([label, value]) => `<tr><th align="left">${escapeHtml(label!)}</th><td>${escapeHtml(value!)}</td></tr>`)
    .join('');
  return `<h1>Neue Kontaktanfrage</h1>
<table cellpadding="6">${rows}</table>
<p style="white-space:pre-wrap">${escapeHtml(form.message)}</p>`;
}

/** Alte WordPress-URLs dauerhaft auf die neuen Seiten umleiten. */
const redirects: Record<string, string> = {
  '/kontakt': '/kontakt/',
  '/leistungen': '/leistungen/',
  '/shop': '/shop/',
  '/impressum': '/impressum/',
  '/datenschutz': '/datenschutz/',
  '/agb': '/agb/',
  '/widerruf': '/widerruf/',
  '/versand': '/versand/',
  '/zahlung': '/zahlung/',
  '/cookie-hinweis': '/cookie-hinweis/',
  '/versandarten/': '/versand/',
  '/bezahlmoeglichkeiten/': '/zahlung/',
  '/widerrufsbelehrung/': '/widerruf/',
  '/cookie-richtlinie-eu/': '/datenschutz/#cookies',
  '/echtheit-von-bewertungen/': '/datenschutz/#bewertungen',
  '/hallo-welt/': '/',
  '/mein-konto/': '/kontakt/',
  '/feed/': '/',
  '/startseite/feed/': '/',
  '/shop/feed/': '/',
  '/comments/feed/': '/',
  '/wp-sitemap.xml': '/sitemap.xml',
  '/xmlrpc.php': '/',
  '/wp-login.php': '/admin',
};

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    render(reply, 'pages/home.njk', {
      content: getContent(),
      services,
      localBusinessJsonLd: [localBusinessJsonLd, websiteJsonLd],
    });
  });

  app.get('/robots.txt', async (_request, reply) => {
    const lines = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /warenkorb/',
      'Disallow: /kasse/',
      'Disallow: /bestellung/',
      'Disallow: /kontakt/danke/',
      '',
      `Sitemap: ${config.site.baseUrl}/sitemap.xml`,
      '',
    ];
    return reply.type('text/plain; charset=utf-8').send(lines.join('\n'));
  });

  app.get('/sitemap.xml', async (_request, reply) => {
    const staticPages: { path: string; priority: string; changefreq: string }[] = [
      { path: '/', priority: '1.0', changefreq: 'weekly' },
      { path: '/leistungen/', priority: '0.9', changefreq: 'monthly' },
      { path: '/3d-druck-rechner/', priority: '0.9', changefreq: 'monthly' },
      { path: '/shop/', priority: '0.9', changefreq: 'weekly' },
      { path: '/kontakt/', priority: '0.7', changefreq: 'yearly' },
      { path: '/impressum/', priority: '0.3', changefreq: 'yearly' },
      { path: '/datenschutz/', priority: '0.3', changefreq: 'yearly' },
      { path: '/agb/', priority: '0.3', changefreq: 'yearly' },
      { path: '/widerruf/', priority: '0.3', changefreq: 'yearly' },
      { path: '/versand/', priority: '0.4', changefreq: 'yearly' },
      { path: '/zahlung/', priority: '0.4', changefreq: 'yearly' },
    ];

    const products = getDb()
      .prepare('SELECT slug, updated_at FROM products WHERE active = 1 ORDER BY sort_order, id')
      .all() as { slug: string; updated_at: string }[];

    const escapeXml = (value: string): string =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

    const url = (path: string, priority: string, changefreq: string, lastmod?: string): string => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(`${config.site.baseUrl}${path}`)}</loc>`,
      ];
      if (lastmod) lines.push(`    <lastmod>${lastmod.slice(0, 10)}</lastmod>`);
      lines.push(`    <changefreq>${changefreq}</changefreq>`, `    <priority>${priority}</priority>`, '  </url>');
      return lines.join('\n');
    };

    const entries = [
      ...staticPages.map((page) => url(page.path, page.priority, page.changefreq)),
      ...products.map((product) => url(`/shop/${product.slug}/`, '0.8', 'weekly', product.updated_at)),
    ];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n');

    return reply.type('application/xml; charset=utf-8').send(xml);
  });

  app.get('/api/health', async (_request, reply) => {
    let dbOk = true;
    try {
      getDb().prepare('SELECT 1').get();
    } catch {
      dbOk = false;
    }
    return reply.code(dbOk ? 200 : 503).send({
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'ok' : 'error',
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    });
  });

  app.get('/leistungen/', async (_request, reply) => {
    render(reply, 'pages/leistungen.njk', { printers: getPrinters() });
  });

  app.get('/kontakt/', async (_request, reply) => {
    render(reply, 'pages/kontakt.njk', {
      subjects: contactSubjects,
      form: {} as Partial<ContactForm>,
    });
  });

  app.post(
    '/kontakt/',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const form = readContactForm(request);
      const body = (request.body ?? {}) as Record<string, unknown>;

      // Honeypot: Bots füllen das unsichtbare Feld. Wir tun so, als wäre alles gut.
      if (cleanText(body.website, 100)) {
        request.log.warn({ ip: request.ip }, 'Kontaktformular: Honeypot ausgelöst');
        return reply.redirect('/kontakt/danke/', 303);
      }

      if (!isSameOrigin(request)) {
        reply.code(403);
        return render(reply, 'pages/kontakt.njk', {
          subjects: contactSubjects,
          form,
          error: 'Die Anfrage konnte nicht zugeordnet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
        });
      }

      const parsed = contactSchema.safeParse(form);
      if (!parsed.success) {
        reply.code(400);
        return render(reply, 'pages/kontakt.njk', {
          subjects: contactSubjects,
          form,
          error: contactErrorMessage(parsed.error),
        });
      }

      const data = parsed.data;
      getDb()
        .prepare('INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)')
        .run(data.name, data.email, data.phone, data.subject, data.message);

      try {
        await notifyAdmin({
          subject: `[Kontakt] ${data.subject} – ${data.name}`,
          text: contactMailText(data),
          html: contactMailHtml(data),
          replyTo: data.email,
        });
      } catch (error) {
        // Die Anfrage ist gespeichert; ein Mailfehler darf den Vorgang nicht verhindern.
        request.log.error({ err: error }, 'Kontaktanfrage gespeichert, aber E-Mail-Versand fehlgeschlagen');
      }

      request.log.info({ subject: data.subject }, 'Kontaktanfrage gespeichert');
      return reply.redirect('/kontakt/danke/', 303);
    },
  );

  app.get('/kontakt/danke/', async (_request, reply) => {
    render(reply, 'pages/kontakt-danke.njk');
  });

  app.get('/impressum/', async (_request, reply) => render(reply, 'pages/legal/impressum.njk'));
  app.get('/datenschutz/', async (_request, reply) => render(reply, 'pages/legal/datenschutz.njk'));
  app.get('/agb/', async (_request, reply) => render(reply, 'pages/legal/agb.njk'));
  app.get('/widerruf/', async (_request, reply) => render(reply, 'pages/legal/widerruf.njk'));
  app.get('/versand/', async (_request, reply) => render(reply, 'pages/legal/versand.njk'));
  app.get('/zahlung/', async (_request, reply) => {
    const settings = getShopSettings();
    const paymentMethods = getPublicPaymentMethods();
    render(reply, 'pages/legal/zahlung.njk', {
      paymentMethods,
      hasStripeMethods: paymentMethods.some((method) => method.provider === 'stripe'),
      bank: settings.bank,
      bankConfigured: isBankConfigured(settings.bank),
      stripeConfigured: isStripeConfigured(),
    });
  });
  app.get('/cookie-hinweis/', async (_request, reply) => render(reply, 'pages/legal/cookies.njk'));

  app.get(
    '/produkt/recycling-box-mit-deckel-fuer-leere-batterien-zur-aufbewahrung-gebrauchter-batterien/',
    async (_request, reply) => reply.redirect('/shop/recycling-box-batterien/', 301),
  );
  app.get('/produkt/*', async (_request, reply) => reply.redirect('/shop/', 301));

  for (const [from, to] of Object.entries(redirects)) {
    app.get(from, async (_request, reply) => reply.redirect(to, 301));
  }
}
