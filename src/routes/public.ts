import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';

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

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    render(reply, 'pages/home.njk', {
      content: getContent(),
      services,
    });
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

  // Platzhalterseiten für Phase 1 – werden in Phase 2 durch echte Inhalte ersetzt.
  const placeholders: Record<string, { title: string; description: string }> = {
    '/leistungen/': { title: 'Leistungen & Materialien', description: 'Materialvergleich, Drucker und Einsatzgebiete.' },
    '/3d-druck-rechner/': { title: '3D-Druck-Rechner', description: 'Modell hochladen, konfigurieren und Preis schätzen.' },
    '/shop/': { title: 'Shop', description: 'Fertige 3D-Druck-Produkte aus eigener Fertigung.' },
    '/kontakt/': { title: 'Kontakt', description: 'Fragen zu Ihrem Projekt? Schreiben Sie uns.' },
    '/impressum/': { title: 'Impressum', description: 'Angaben gemäß § 5 TMG.' },
    '/datenschutz/': { title: 'Datenschutzerklärung', description: 'Informationen zur Verarbeitung personenbezogener Daten.' },
    '/agb/': { title: 'Allgemeine Geschäftsbedingungen', description: 'Bedingungen für Bestellungen über unseren Shop.' },
    '/widerruf/': { title: 'Widerrufsbelehrung', description: 'Ihr Widerrufsrecht und das Muster-Widerrufsformular.' },
    '/versand/': { title: 'Versandarten', description: 'Versandkosten und Lieferzeiten im Überblick.' },
    '/zahlung/': { title: 'Zahlungsarten', description: 'Verfügbare Zahlungsmethoden.' },
    '/cookie-hinweis/': { title: 'Cookie-Hinweis', description: 'Welche Cookies wir einsetzen.' },
  };
  for (const [path, meta] of Object.entries(placeholders)) {
    app.get(path, async (_request, reply) => render(reply, 'pages/placeholder.njk', meta));
  }
}
