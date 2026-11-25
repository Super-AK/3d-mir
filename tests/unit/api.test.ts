import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
  ipAllowed,
  normalizeIp,
} = await import('../../src/lib/api-auth.js');
const { apiOrderStatus, customerExternalId, toIso } = await import('../../src/lib/api-mapper.js');
const {
  deliverPendingWebhooks,
  generateWebhookSecret,
  queueWebhook,
  listWebhookDeliveries,
} = await import('../../src/lib/api-webhooks.js');
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
    expect(API_VERSION).toBe('1.1.0');
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

  it('nutzt nur die letzte X-Forwarded-For-IP als Fallback', () => {
    const created = createApiToken({ name: 'Proxy', scopes: ['orders:read'], ipAllowlist: ['203.0.113.10'] });
    expect(resolveApiToken(`Bearer ${created.token}`, '127.0.0.1', '198.51.100.9, 203.0.113.10')).not.toBeNull();
    expect(resolveApiToken(`Bearer ${created.token}`, '127.0.0.1', '203.0.113.10, 198.51.100.9')).toBeNull();
  });

  it('hält den alten Token nach der Rotation übergangsweise gültig', () => {
    const created = createApiToken({ name: 'Rotation', scopes: ['orders:read'] });
    const rotated = rotateApiToken(created.info.id);
    expect(rotated?.token).not.toBe(created.token);
    expect(resolveApiToken(`Bearer ${created.token}`, '127.0.0.1')).not.toBeNull();
    expect(resolveApiToken(`Bearer ${rotated!.token}`, '127.0.0.1')).not.toBeNull();
  });
});

describe('API v1 – IP-Allowlist', () => {
  it('normalisiert IPv4-gemappte IPv6-Adressen', () => {
    expect(normalizeIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
    expect(normalizeIp(' 2001:DB8::1 ')).toBe('2001:db8::1');
  });

  it('prüft exakte IPs und CIDR-Bereiche', () => {
    expect(ipAllowed(['203.0.113.10'], '203.0.113.10')).toBe(true);
    expect(ipAllowed(['::ffff:203.0.113.10'], '203.0.113.10')).toBe(true);
    expect(ipAllowed(['203.0.113.10'], '::ffff:203.0.113.10')).toBe(true);
    expect(ipAllowed(['198.51.100.0/24'], '198.51.100.42')).toBe(true);
    expect(ipAllowed(['198.51.100.0/24'], '198.51.101.1')).toBe(false);
    expect(ipAllowed(['2001:db8::/32'], '2001:db8::1')).toBe(true);
    expect(ipAllowed([], '1.2.3.4')).toBe(true);
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

describe('API v1 – Webhooks (Phase 2)', () => {
  it('versendet signierte Ereignisse und protokolliert die Zustellung', async () => {
    const settings = getApiSettings();
    saveApiSettings({
      ...settings,
      webhooks: {
        enabled: true,
        url: 'https://example.test/hook',
        secret: 'test-geheimnis',
        events: ['order.created'],
      },
    });
    const id = queueWebhook('order.created', '1', '2026-11-24T10:00:00Z');
    expect(id).not.toBeNull();

    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const result = await deliverPendingWebhooks();
      expect(result.sent).toBeGreaterThanOrEqual(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://example.test/hook');
      const headers = options.headers as Record<string, string>;
      expect(headers['X-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
      expect(headers['X-Timestamp']).toMatch(/^\d+$/);
      expect(JSON.parse(String(options.body))).toMatchObject({ event: 'order.created', id: '1' });
    } finally {
      vi.unstubAllGlobals();
      saveApiSettings(defaultApiSettings());
    }
    const delivered = listWebhookDeliveries().find((row) => row.id === id);
    expect(delivered?.status).toBe('delivered');
  });

  it('erzeugt ein langes Secret', () => {
    expect(generateWebhookSecret()).toMatch(/^[a-f0-9]{64}$/);
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
    const metaData = meta.json() as { customer_numbers: { pattern: string; range_start: string } };
    expect(metaData.customer_numbers.range_start).toBe('KD900001');

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

  it('nimmt die Status-Rückmeldung idempotent an', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const body = { status: 'shipped', tracking_number: 'TEST-TRACK-1' };
    const first = await app.inject({ method: 'PATCH', url: '/api/v1/orders/1/status', payload: body, headers });
    expect(first.statusCode).toBe(200);
    expect((first.json() as { status: string }).status).toBe('shipped');
    const second = await app.inject({ method: 'PATCH', url: '/api/v1/orders/1/status', payload: body, headers });
    expect(second.statusCode).toBe(200);
    const order = await app.inject({ method: 'GET', url: '/api/v1/orders/1', headers });
    expect((order.json() as { shipping: { tracking_number: string } }).shipping.tracking_number).toBe('TEST-TRACK-1');
    const audits = getDb().prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action = 'api.status.update'").get() as { count: number };
    expect(audits.count).toBe(1);
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
