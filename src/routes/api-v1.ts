import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { writeAudit } from '../lib/auth.js';
import { hasApiScope, resolveApiToken } from '../lib/api-auth.js';
import { queueWebhook, webhookConfigured } from '../lib/api-webhooks.js';
import {
  API_ORDER_STATUSES,
  API_VERSION,
  getApiSettings,
  type ApiScope,
  type ApiSettings,
} from '../lib/api-settings.js';
import {
  apiOrderStatus,
  customerExternalId,
  mapCustomer,
  mapOrder,
  mapProduct,
  toIso,
  type OrderRow,
  type ProductRow,
} from '../lib/api-mapper.js';

const utcNow = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const dbTime = (iso: string): string => iso.replace('T', ' ').replace('Z', '').slice(0, 19);

type ErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'resource_disabled'
  | 'not_found'
  | 'validation_failed'
  | 'rate_limited'
  | 'maintenance'
  | 'api_disabled'
  | 'server_error';

function apiError(code: ErrorCode, message: string, requestId: string): Record<string, unknown> {
  return { error: { code, message, request_id: requestId } };
}

function fail(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string,
): FastifyReply {
  return reply.code(status).send(apiError(code, message, requestId));
}

type Cursor = { u: string; i: number };

function encodeCursor(updatedAt: string, id: number): string {
  return Buffer.from(JSON.stringify({ u: updatedAt, i: id })).toString('base64url');
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof parsed.u === 'string' && typeof parsed.i === 'number' && Number.isFinite(parsed.i)) {
      return { u: parsed.u, i: parsed.i };
    }
  } catch {
    // Ungültige Cursor werden als fehlende Cursor behandelt.
  }
  return null;
}

function listParams(request: FastifyRequest):
  | { error: string }
  | { limit: number; cursor: Cursor | null; updatedSince: string | null; status: string | null } {
  const query = (request.query ?? {}) as Record<string, unknown>;
  const rawLimit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : Number.NaN;
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;
  const cursor = decodeCursor(typeof query.cursor === 'string' ? query.cursor : undefined);
  let updatedSince: string | null = null;
  if (typeof query.updated_since === 'string' && query.updated_since) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(query.updated_since)) {
      return { error: 'updated_since muss eine ISO-8601-Zeitangabe in UTC sein.' };
    }
    updatedSince = dbTime(query.updated_since);
  }
  const status = typeof query.status === 'string' && query.status ? query.status : null;
  return { limit, cursor, updatedSince, status };
}

function listResponse(data: unknown[], hasMore: boolean, last: { updated_at: string; id: number } | null) {
  const nextCursor = hasMore && last ? encodeCursor(toIso(last.updated_at) ?? last.updated_at, last.id) : null;
  return { data, next_cursor: nextCursor, has_more: hasMore, server_time: utcNow() };
}

function internalStatusesFor(status: string): string[] | null {
  if (status === 'refunded') return null;
  const values = API_ORDER_STATUSES.filter(
    (internal) => apiOrderStatus(internal, 'bezahlt') === status || apiOrderStatus(internal, 'offen') === status,
  );
  return [...values];
}

function orderWhere(
  settings: ApiSettings,
  cursor: Cursor | null,
  updatedSince: string | null,
  statusFilter: string | null,
): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (cursor) {
    clauses.push('(updated_at > ? OR (updated_at = ? AND id > ?))');
    params.push(cursor.u, cursor.u, cursor.i);
  }
  if (updatedSince) {
    clauses.push('updated_at >= ?');
    params.push(updatedSince);
  }
  const exposed = settings.orderStatuses;
  if (exposed.length) {
    clauses.push(`(status IN (${exposed.map(() => '?').join(',')}) OR api_first_exposed_at IS NOT NULL)`);
    params.push(...exposed);
  } else {
    clauses.push('api_first_exposed_at IS NOT NULL');
  }
  if (settings.onlyPaid) clauses.push("payment_status = 'bezahlt'");
  if (!settings.includeGuests) clauses.push('user_id IS NOT NULL');
  if (settings.fromDate) {
    clauses.push('created_at >= ?');
    params.push(`${settings.fromDate} 00:00:00`);
  }
  if (statusFilter) {
    if (statusFilter === 'refunded') {
      clauses.push("payment_status = 'erstattet'");
    } else {
      const internal = internalStatusesFor(statusFilter);
      if (!internal?.length) clauses.push('1 = 0');
      else {
        clauses.push(`status IN (${internal.map(() => '?').join(',')})`);
        params.push(...internal);
      }
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function markExposed(rows: { id: number; api_first_exposed_at: string | null }[]): void {
  const update = getDb().prepare(
    "UPDATE orders SET api_first_exposed_at = datetime('now') WHERE id = ? AND api_first_exposed_at IS NULL",
  );
  for (const row of rows) if (!row.api_first_exposed_at) update.run(row.id);
}

const invoiceSchema = z.object({
  invoice_number: z.string().min(1).max(100),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss JJJJ-MM-DD sein.'),
  invoice_url: z
    .string()
    .url()
    .max(500)
    .refine((value) => value.startsWith('https://'), 'Die URL muss HTTPS verwenden.')
    .optional()
    .default(''),
  delivery_note_number: z.string().max(100).optional().default(''),
});

const statusSchema = z.object({
  status: z.enum(['pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded']),
  tracking_number: z.string().max(200).optional().default(''),
});

const rateHits = new Map<number, number[]>();

function rateCheck(tokenId: number, max: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (rateHits.get(tokenId) ?? []).filter((time) => now - time < 60_000);
  if (hits.length >= max) {
    rateHits.set(tokenId, hits);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((hits[0]! + 60_000 - now) / 1000)) };
  }
  hits.push(now);
  rateHits.set(tokenId, hits);
  return { ok: true, retryAfter: 0 };
}

function requireScope(request: FastifyRequest, reply: FastifyReply, scope: ApiScope): boolean {
  if (hasApiScope(request.apiToken ?? null, scope)) return true;
  fail(reply, 403, 'forbidden', `Scope ${scope} fehlt.`, request.apiRequestId ?? 'req_unknown');
  return false;
}

function requireResource(
  request: FastifyRequest,
  reply: FastifyReply,
  settings: ApiSettings,
  resource: keyof ApiSettings['resources'],
): boolean {
  if (settings.resources[resource]) return true;
  fail(reply, 403, 'resource_disabled', `Ressource ${resource} ist nicht freigegeben.`, request.apiRequestId ?? 'req_unknown');
  return false;
}

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    request.apiRequestId = requestId;
    const settings = getApiSettings();
    reply.header('X-Request-Id', requestId).header('X-Config-Version', String(settings.configVersion));

    if (!settings.enabled) {
      return fail(reply, 503, 'api_disabled', 'Die API ist deaktiviert.', requestId);
    }
    if (settings.maintenance) {
      reply.header('Retry-After', '300');
      return fail(reply, 503, 'maintenance', 'Wartungsmodus: bitte später erneut versuchen.', requestId);
    }

    const token = resolveApiToken(request.headers.authorization, request.ip);
    request.apiToken = token;
    if (!token) {
      return fail(reply, 401, 'unauthorized', 'Ungültiger oder fehlender API-Token.', requestId);
    }
    const limit = rateCheck(token.tokenId, settings.rateLimitPerMinute);
    if (!limit.ok) {
      reply.header('Retry-After', String(limit.retryAfter));
      return fail(reply, 429, 'rate_limited', 'Zu viele Anfragen.', requestId);
    }
    return undefined;
  });

  app.addHook('onResponse', async (request, reply) => {
    const requestId = request.apiRequestId ?? 'req_unknown';
    const token = request.apiToken;
    try {
      getDb()
        .prepare(
          `INSERT INTO api_access_log
             (request_id, token_id, token_name, method, path, status, duration_ms, item_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        )
        .run(
          requestId,
          token?.tokenId ?? null,
          token?.name ?? '',
          request.method,
          request.url.split('?')[0] ?? request.url,
          reply.statusCode,
          Math.round(reply.elapsedTime),
          request.apiItemCount ?? 0,
        );
    } catch {
      // Protokollfehler dürfen die Antwort nicht verändern.
    }
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    const requestId = request.apiRequestId ?? 'req_unknown';
    const err = error instanceof Error ? error : new Error('Interner Fehler.');
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    const status = typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 500;
    const code: ErrorCode = error instanceof z.ZodError ? 'validation_failed' : status === 400 ? 'invalid_request' : 'server_error';
    const message = error instanceof z.ZodError ? 'Die Eingabe ist ungültig.' : 'Interner Fehler.';
    return fail(reply, status, code, message, requestId);
  });

  app.setNotFoundHandler((request, reply) => {
    return fail(reply, 404, 'not_found', 'Endpunkt nicht gefunden.', request.apiRequestId ?? 'req_unknown');
  });

  app.get('/health', async (_request, reply) => {
    let database = 'ok';
    let status = 'ok';
    try {
      getDb().prepare('SELECT 1').get();
    } catch {
      database = 'error';
      status = 'degraded';
    }
    return reply.send({ status, version: API_VERSION, time: utcNow(), database });
  });

  app.get('/meta', async (_request, reply) => {
    const settings = getApiSettings();
    const exposedStatuses = [
      ...settings.orderStatuses.map((status) => apiOrderStatus(status, 'bezahlt')),
    ];
    if (!exposedStatuses.includes('refunded') && settings.orderStatuses.includes('storniert')) {
      exposedStatuses.push('refunded');
    }
    const orderFields = [
      'id',
      'order_number',
      'status',
      'created_at',
      'updated_at',
      'currency',
      'customer_id',
      'customer_snapshot',
      'billing_address',
      'shipping_address',
      'items',
      'shipping',
      'discounts',
      'totals',
      'tax_info',
      'payment',
      'meta.source_channel',
      'invoice',
    ];
    if (settings.fields.phone) orderFields.push('customer_snapshot.phone');
    if (settings.fields.vatId) orderFields.push('customer_snapshot.vat_id');
    if (settings.fields.customerNote) orderFields.push('customer_note');
    if (settings.fields.attributes3d) orderFields.push('items.attributes.material', 'items.attributes.color');
    if (settings.fields.modelFile) orderFields.push('items.attributes.model_file');
    for (const field of settings.customFields) {
      orderFields.push(field.target === 'item' ? `items.attributes.${field.key}` : `meta.${field.key}`);
    }
    const customerFields = ['id', 'email', 'first_name', 'last_name', 'type', 'company', 'billing_address', 'is_guest'];
    if (settings.fields.phone) customerFields.push('phone');
    if (settings.fields.vatId) customerFields.push('vat_id');
    if (settings.fields.marketingConsent) customerFields.push('marketing_consent');

    return reply.send({
      api_version: API_VERSION,
      config_version: settings.configVersion,
      tax_mode: config.site.business.smallBusiness ? 'small_business_19_ustg' : 'standard',
      resources: settings.resources,
      order_statuses_exposed: [...new Set(exposedStatuses)],
      fields: {
        orders: [...new Set(orderFields)],
        customers: customerFields,
        item_attributes: settings.fields.attributes3d
          ? ['material', 'color', 'infill_percent', ...(settings.fields.modelFile ? ['model_file'] : [])]
          : [],
      },
      webhooks_enabled: webhookConfigured(),
      server_time: utcNow(),
    });
  });

  app.get('/orders', async (request, reply) => {
    if (!requireScope(request, reply, 'orders:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'orders')) return reply;
    const params = listParams(request);
    if ('error' in params) return fail(reply, 400, 'invalid_request', params.error, request.apiRequestId!);
    if (params.status && !internalStatusesFor(params.status) && params.status !== 'refunded') {
      return fail(reply, 400, 'invalid_request', 'Unbekannter Status.', request.apiRequestId!);
    }

    const { sql, params: values } = orderWhere(settings, params.cursor, params.updatedSince, params.status);
    const rows = getDb()
      .prepare(`SELECT * FROM orders ${sql} ORDER BY updated_at ASC, id ASC LIMIT ?`)
      .all(...values, params.limit + 1) as OrderRow[];
    const page = rows.slice(0, params.limit);
    markExposed(page);
    request.apiItemCount = page.length;
    const last = page[page.length - 1];
    return reply.send(
      listResponse(
        page.map((row) => mapOrder(row, settings)),
        rows.length > params.limit,
        last ? { updated_at: last.updated_at, id: last.id } : null,
      ),
    );
  });

  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'orders:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'orders')) return reply;
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(reply, 400, 'invalid_request', 'Ungültige Bestell-ID.', request.apiRequestId!);
    }
    const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
    if (!row) return fail(reply, 404, 'not_found', `Order ${id} not found`, request.apiRequestId!);
    const exposed = settings.orderStatuses.includes(row.status) || row.api_first_exposed_at;
    if (!exposed) return fail(reply, 404, 'not_found', `Order ${id} not found`, request.apiRequestId!);
    markExposed([row]);
    request.apiItemCount = 1;
    return reply.send(mapOrder(row, settings));
  });

  app.patch<{ Params: { id: string } }>('/orders/:id/invoice', async (request, reply) => {
    if (!requireScope(request, reply, 'orders:write_status')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'orders')) return reply;
    if (!settings.invoiceFeedback) {
      return fail(reply, 403, 'resource_disabled', 'Rückmeldungen sind deaktiviert.', request.apiRequestId!);
    }
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(reply, 400, 'invalid_request', 'Ungültige Bestell-ID.', request.apiRequestId!);
    }
    const parsed = invoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 422, 'validation_failed', 'Rechnungsdaten sind ungültig.', request.apiRequestId!);
    }
    const body = parsed.data;
    const existing = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
    if (!existing) return fail(reply, 404, 'not_found', `Order ${id} not found`, request.apiRequestId!);
    const unchanged =
      existing.invoice_number === body.invoice_number &&
      existing.invoice_date === body.invoice_date &&
      existing.invoice_url === body.invoice_url &&
      existing.delivery_note_number === body.delivery_note_number;
    if (!unchanged) {
      getDb()
        .prepare(
          `UPDATE orders SET invoice_number = ?, invoice_date = ?, invoice_url = ?,
             delivery_note_number = ?, invoice_updated_at = datetime('now') WHERE id = ?`,
        )
        .run(body.invoice_number, body.invoice_date, body.invoice_url, body.delivery_note_number, id);
      writeAudit('api', 'api.invoice.update', { order: id, invoice: body.invoice_number });
    }
    const updated = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow;
    request.apiItemCount = 1;
    return reply.send(mapOrder(updated, settings));
  });

  app.patch<{ Params: { id: string } }>('/orders/:id/status', async (request, reply) => {
    if (!requireScope(request, reply, 'orders:write_status')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'orders')) return reply;
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(reply, 400, 'invalid_request', 'Ungültige Bestell-ID.', request.apiRequestId!);
    }
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) {
      return fail(reply, 422, 'validation_failed', 'Status ist ungültig.', request.apiRequestId!);
    }
    const body = parsed.data;
    const current = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
    if (!current) return fail(reply, 404, 'not_found', `Order ${id} not found`, request.apiRequestId!);

    let status = current.status;
    let paymentStatus = current.payment_status;
    switch (body.status) {
      case 'pending':
      case 'awaiting_payment':
        status = 'neu';
        paymentStatus = 'offen';
        break;
      case 'paid':
        status = 'bezahlt';
        paymentStatus = 'bezahlt';
        break;
      case 'processing':
        status = 'in_druck';
        break;
      case 'shipped':
        status = 'versandt';
        break;
      case 'completed':
        status = 'abgeschlossen';
        break;
      case 'cancelled':
        status = 'storniert';
        break;
      case 'refunded':
        paymentStatus = 'erstattet';
        break;
    }
    const tracking = body.tracking_number || current.tracking_number;
    if (current.status === status && current.payment_status === paymentStatus && current.tracking_number === tracking) {
      request.apiItemCount = 1;
      return reply.send(mapOrder(current, settings));
    }

    getDb()
      .prepare(
        `UPDATE orders SET status = ?, payment_status = ?, tracking_number = ?, updated_at = datetime('now'),
           paid_at = CASE WHEN ? = 'bezahlt' AND paid_at IS NULL THEN datetime('now') ELSE paid_at END
         WHERE id = ?`,
      )
      .run(status, paymentStatus, tracking, paymentStatus, id);
    writeAudit('api', 'api.status.update', { order: id, from: current.status, to: status, tracking });
    queueWebhook('order.updated', String(id));
    const updated = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow;
    request.apiItemCount = 1;
    return reply.send(mapOrder(updated, settings));
  });

  app.get('/customers', async (request, reply) => {
    if (!requireScope(request, reply, 'customers:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'customers')) return reply;
    const params = listParams(request);
    if ('error' in params) return fail(reply, 400, 'invalid_request', params.error, request.apiRequestId!);

    const { sql, params: values } = orderWhere(settings, null, params.updatedSince, null);
    const cursorClause = params.cursor
      ? 'WHERE (updated > ? OR (updated = ? AND last_id > ?))'
      : '';
    const cursorParams = params.cursor ? [params.cursor.u, params.cursor.u, params.cursor.i] : [];
    const groups = getDb()
      .prepare(
        `SELECT * FROM (
           SELECT lower(email) AS email_key, MAX(updated_at) AS updated, MAX(id) AS last_id
           FROM orders ${sql} GROUP BY lower(email)
         ) ${cursorClause} ORDER BY updated ASC, last_id ASC LIMIT ?`,
      )
      .all(...values, ...cursorParams, params.limit + 1) as { email_key: string; updated: string; last_id: number }[];
    const page = groups.slice(0, params.limit);

    const data: Record<string, unknown>[] = [];
    for (const group of page) {
      const orders = getDb()
        .prepare('SELECT * FROM orders WHERE lower(email) = ? ORDER BY created_at ASC, id ASC')
        .all(group.email_key) as OrderRow[];
      const customer = mapCustomer(orders, settings);
      if (customer) data.push(customer);
    }
    request.apiItemCount = data.length;
    const last = page[page.length - 1];
    return reply.send(
      listResponse(
        data,
        groups.length > params.limit,
        last ? { updated_at: last.updated, id: last.last_id } : null,
      ),
    );
  });

  app.get<{ Params: { id: string } }>('/customers/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'customers:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'customers')) return reply;
    const { id } = request.params;
    if (!/^(usr_\d+|cus_[a-f0-9]{16})$/.test(id)) {
      return fail(reply, 400, 'invalid_request', 'Ungültige Kunden-ID.', request.apiRequestId!);
    }
    const rows = getDb().prepare('SELECT * FROM orders ORDER BY created_at ASC, id ASC').all() as OrderRow[];
    const matching = rows.filter((row) => customerExternalId(row.email, row.user_id) === id);
    const customer = mapCustomer(matching, settings);
    if (!customer) return fail(reply, 404, 'not_found', `Customer ${id} not found`, request.apiRequestId!);
    request.apiItemCount = 1;
    return reply.send(customer);
  });

  function productWhere(cursor: Cursor | null, updatedSince: string | null): { sql: string; params: unknown[] } {
    const settings = getApiSettings();
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (cursor) {
      clauses.push('(updated_at > ? OR (updated_at = ? AND id > ?))');
      params.push(cursor.u, cursor.u, cursor.i);
    }
    if (updatedSince) {
      clauses.push('updated_at >= ?');
      params.push(updatedSince);
    }
    if (settings.products.onlyActive) clauses.push('active = 1');
    if (settings.products.onlyWithSku) clauses.push("TRIM(sku) <> ''");
    if (settings.products.categories.length) {
      clauses.push(
        `EXISTS (SELECT 1 FROM product_category_links l
                 JOIN product_categories c ON c.id = l.category_id
                 WHERE l.product_id = products.id AND c.slug IN (${settings.products.categories.map(() => '?').join(',')}))`,
      );
      params.push(...settings.products.categories);
    }
    return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  app.get('/products', async (request, reply) => {
    if (!requireScope(request, reply, 'products:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'products')) return reply;
    const params = listParams(request);
    if ('error' in params) return fail(reply, 400, 'invalid_request', params.error, request.apiRequestId!);
    const where = productWhere(params.cursor, params.updatedSince);
    const rows = getDb()
      .prepare(`SELECT * FROM products ${where.sql} ORDER BY updated_at ASC, id ASC LIMIT ?`)
      .all(...where.params, params.limit + 1) as ProductRow[];
    const page = rows.slice(0, params.limit);
    const variantsStmt = getDb().prepare(
      'SELECT label, price_cents, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, label ASC',
    );
    const data = page.map((row) => mapProduct(row, variantsStmt.all(row.id) as { label: string; price_cents: number; stock: number }[], settings));
    request.apiItemCount = data.length;
    const last = page[page.length - 1];
    return reply.send(
      listResponse(data, rows.length > params.limit, last ? { updated_at: last.updated_at, id: last.id } : null),
    );
  });

  app.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    if (!requireScope(request, reply, 'products:read')) return reply;
    const settings = getApiSettings();
    if (!requireResource(request, reply, settings, 'products')) return reply;
    const id = Number.parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(reply, 400, 'invalid_request', 'Ungültige Artikel-ID.', request.apiRequestId!);
    }
    const row = getDb().prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
    if (!row) return fail(reply, 404, 'not_found', `Product ${id} not found`, request.apiRequestId!);
    const variants = getDb()
      .prepare('SELECT label, price_cents, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, label ASC')
      .all(id) as { label: string; price_cents: number; stock: number }[];
    request.apiItemCount = 1;
    return reply.send(mapProduct(row, variants, settings));
  });
}
