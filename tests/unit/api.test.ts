import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dbPath = path.join('/tmp/opencode', `api-test-${process.pid}.sqlite`);
const dataDir = path.join('/tmp/opencode', `api-test-data-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.UPLOAD_DIR = path.join(dataDir, 'uploads');
process.env.LOG_DIR = path.join(dataDir, 'logs');
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'api-test-session-secret-with-at-least-32-chars';

const { getDb } = await import('../../src/db/index.js');
const { migrate } = await import('../../src/db/migrate.js');
const {
  getApiSettings,
  saveApiSettings,
  defaultApiSettings,
  API_VERSION,
} = await import('../../src/lib/api-settings.js');
const {
  createApiToken,
  resolveApiToken,
  revokeApiToken,
  rotateApiToken,
  hasApiScope,
} = await import('../../src/lib/api-auth.js');
const { apiOrderStatus, customerExternalId, toIso } = await import('../../src/lib/api-mapper.js');
const { buildApp } = await import('../../src/app.js');

beforeAll(() => {
  migrate();
});

afterAll(async () => {
  getDb().close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${dbPath}${suffix}`);
    } catch {
      // Datei existiert nicht mehr.
    }
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('API v1 – Grundeinstellungen', () => {
  it('verwendet sinnvolle Standard-Freigaben', () => {
    const settings = defaultApiSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.rateLimitPerMinute).toBe(60);
    expect(settings.resources).toEqual({ orders: true, customers: true, products: true });
    expect(API_VERSION).toBe('1.0.0');
  });

  it('erhöht config_version bei jeder Änderung', () => {
    const before = getApiSettings().configVersion;
    const saved = saveApiSettings({ ...getApiSettings(), maintenance: true });
    expect(saved.configVersion).toBe(before + 1);
    expect(saved.maintenance).toBe(true);
    saveApiSettings(defaultApiSettings());
  });
});

describe('API v1 – Tokens', () => {
  it('löst einen gültigen Token auf und erkennt Scopes', () => {
    const created = createApiToken({ name: 'Test', scopes: ['orders:read'] });
    const resolved = resolveApiToken(`Bearer ${created.token}`, '127.0.0.1');
    expect(resolved?.name).toBe('Test');
    expect(hasApiScope(resolved, 'orders:read')).toBe(true);
    expect(hasApiScope(resolved, 'customers:read')).toBe(false);
  });

  it('lehnt falsche Tokens, Sperren und fremde IPs ab', () => {
    const created = createApiToken({
      name: 'Gesperrt',
      scopes: ['orders:read'],
      ipAllowlist: ['203.0.113.10'],
    });
    expect(resolveApiToken('Bearer falsch', '127.0.0.1')).toBeNull();
    expect(resolveApiToken(`Bearer ${created.token}`, '127.0.0.1')).toBeNull();
    expect(resolveApiToken(`Bearer ${created.token}`, '203.0.113.10')).not.toBeNull();
    revokeApiToken(created.info.id);
    expect(resolveApiToken(`Bearer ${created.token}`, '203.0.113.10')).toBeNull();
  });

  it('hält den alten Token nach der Rotation übergangsweise gültig', () => {
    const created = createApiToken({ name: 'Rotation', scopes: ['orders:read'] });
    const rotated = rotateApiToken(created.info.id);
    expect(rotated?.token).not.toBe(created.token);
    expect(resolveApiToken(`Bearer ${created.token}`, '127.0.0.1')).not.toBeNull();
    expect(resolveApiToken(`Bearer ${rotated!.token}`, '127.0.0.1')).not.toBeNull();
  });
});

describe('API v1 – Mapping', () => {
  it('bildet interne Status auf das Vertrags-Enum ab', () => {
    expect(apiOrderStatus('neu', 'offen')).toBe('awaiting_payment');
    expect(apiOrderStatus('bezahlt', 'bezahlt')).toBe('paid');
    expect(apiOrderStatus('in_druck', 'bezahlt')).toBe('processing');
    expect(apiOrderStatus('versandt', 'bezahlt')).toBe('shipped');
    expect(apiOrderStatus('abgeschlossen', 'bezahlt')).toBe('completed');
    expect(apiOrderStatus('storniert', 'bezahlt')).toBe('cancelled');
    expect(apiOrderStatus('bezahlt', 'erstattet')).toBe('refunded');
  });

  it('erzeugt stabile Kunden-IDs und ISO-Zeitangaben', () => {
    expect(customerExternalId('Max@Example.de', null)).toBe(customerExternalId('max@example.de', null));
    expect(customerExternalId('a@b.de', 5)).toBe('usr_5');
    expect(toIso('2026-11-23 14:05:00')).toBe('2026-11-23T14:05:00Z');
  });
});

describe('API v1 – HTTP-Endpunkte', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let token: string;

  beforeAll(async () => {
    getDb()
      .prepare(
        `INSERT INTO orders
           (order_number, status, email, first_name, last_name, street, zip, city, country,
            payment_method, shipping_method, shipping_cents, subtotal_cents, total_cents,
            payment_status, created_at, updated_at)
         VALUES ('3DM-TEST-1', 'bezahlt', 'test@example.de', 'Erika', 'Beispiel', 'Testweg 1',
                 '75328', 'Schömberg', 'DE', 'paypal', 'DHL Paket', 499, 1250, 1749,
                 'bezahlt', datetime('now'), datetime('now'))`,
      )
      .run();
    getDb()
      .prepare(
        `INSERT INTO order_items
           (order_id, product_id, name, unit_price_cents, quantity, line_total_cents)
         VALUES (1, NULL, 'Testartikel', 1250, 1, 1250)`,
      )
      .run();
    token = createApiToken({ name: 'HTTP-Test', scopes: ['orders:read', 'customers:read', 'products:read', 'orders:write_status'] }).token;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('antwortet ohne Token mit 401 und Request-ID', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['x-request-id']).toMatch(/^req_/);
    expect(response.json().error.code).toBe('unauthorized');
  });

  it('liefert health, meta und Bestellungen mit gültigem Token', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const health = await app.inject({ method: 'GET', url: '/api/v1/health', headers });
    expect(health.statusCode).toBe(200);
    expect(health.json().version).toBe(API_VERSION);

    const meta = await app.inject({ method: 'GET', url: '/api/v1/meta', headers });
    expect(meta.statusCode).toBe(200);
    expect(meta.json()).toMatchObject({ api_version: API_VERSION, webhooks_enabled: false });

    const orders = await app.inject({ method: 'GET', url: '/api/v1/orders?limit=1', headers });
    expect(orders.statusCode).toBe(200);
    const body = orders.json() as { data: Record<string, unknown>[]; next_cursor: string | null; has_more: boolean; server_time: string };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: '1', status: 'paid', currency: 'EUR' });
    expect(body.next_cursor).toBeNull();
    expect(body.has_more).toBe(false);
    expect(body.server_time).toMatch(/Z$/);
  });

  it('erfordert den richtigen Scope', async () => {
    const limited = createApiToken({ name: 'Nur Bestellungen', scopes: ['orders:read'] });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/customers',
      headers: { authorization: `Bearer ${limited.token}` },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('forbidden');
  });

  it('nimmt die Rechnungsrückmeldung idempotent an', async () => {
    const body = {
      invoice_number: 'RE-2026-0042',
      invoice_date: '2026-11-24',
      invoice_url: 'https://faktura-app.knutas.de/re/42?token=abc',
      delivery_note_number: 'LS-2026-0042',
    };
    const headers = { authorization: `Bearer ${token}` };
    const first = await app.inject({ method: 'PATCH', url: '/api/v1/orders/1/invoice', payload: body, headers });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({ method: 'PATCH', url: '/api/v1/orders/1/invoice', payload: body, headers });
    expect(second.statusCode).toBe(200);
    const stored = getDb().prepare('SELECT invoice_number FROM orders WHERE id = 1').get() as { invoice_number: string };
    expect(stored.invoice_number).toBe('RE-2026-0042');
    const audits = getDb().prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action = 'api.invoice.update'").get() as { count: number };
    expect(audits.count).toBe(1);
  });

  it('lehnt ungültige Rechnungsdaten ab', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/orders/1/invoice',
      payload: { invoice_number: 'RE-1', invoice_date: '24.11.2026', invoice_url: 'http://unsicher.example/x' },
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('validation_failed');
  });

  it('meldet Wartungsmodus und Not-Aus als 503', async () => {
    const headers = { authorization: `Bearer ${token}` };
    saveApiSettings({ ...getApiSettings(), maintenance: true });
    const maintenance = await app.inject({ method: 'GET', url: '/api/v1/orders', headers });
    expect(maintenance.statusCode).toBe(503);
    expect(maintenance.headers['retry-after']).toBe('300');
    saveApiSettings({ ...getApiSettings(), maintenance: false, enabled: false });
    const disabled = await app.inject({ method: 'GET', url: '/api/v1/orders', headers });
    expect(disabled.statusCode).toBe(503);
    saveApiSettings(defaultApiSettings());
  });
});
