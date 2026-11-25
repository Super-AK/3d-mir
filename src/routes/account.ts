import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { cleanText, isSameOrigin } from '../lib/http.js';
import { getCustomerById, normalizedEmail, anonymizeCustomer, touchCustomer } from '../lib/customers.js';
import {
  confirmEmailChange,
  createCustomerSession,
  customerCsrf,
  deleteCustomerSession,
  getCustomerSession,
  isStrongPassword,
  loginCustomer,
  registerCustomer,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  verifyCustomerCsrf,
  type CustomerSession,
} from '../lib/customer-auth.js';

export const CUSTOMER_COOKIE = 'mir3d_kunde';

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(10).max(200),
});
const loginSchema = z.object({ email: z.string().email().max(200), password: z.string().max(200) });
const resetSchema = z.object({
  token: z.string().max(200),
  password: z.string().min(10).max(200),
});

function setCookie(reply: FastifyReply, request: FastifyRequest, sessionId: string): void {
  reply.setCookie(CUSTOMER_COOKIE, sessionId, {
    path: '/konto',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    signed: true,
    maxAge: 8 * 60 * 60,
  });
}

function authContext(request: FastifyRequest, session: CustomerSession, extra: Record<string, unknown> = {}) {
  const customer = getCustomerById(session.customerId);
  const query = (request.query ?? {}) as Record<string, unknown>;
  return {
    customer,
    csrf: customerCsrf(session),
    currentPath: '/konto/',
    meldung: { gespeichert: query.gespeichert === '1', fehler: query.fehler === '1' },
    ...extra,
  };
}

/** Prüft, dass die Bestellung wirklich zum eingeloggten Kunden gehört (IDOR). */
function ownOrder(request: FastifyRequest, reply: FastifyReply, id: number, session: CustomerSession) {
  const order = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | { id: number; customer_id: string | null; email: string }
    | undefined;
  const customer = getCustomerById(session.customerId);
  const belongs = Boolean(
    order && customer && (order.customer_id === session.customerId || normalizedEmail(order.email) === customer.email),
  );
  if (!belongs) {
    reply.code(404);
    render(reply, 'pages/error.njk', { statusCode: 404, title: 'Nicht gefunden', message: 'Diese Bestellung gehört nicht zu Ihrem Konto.' });
    return null;
  }
  return order;
}

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get('/konto/registrieren/', async (_request, reply) => {
    render(reply, 'account/auth.njk', { mode: 'register', currentPath: '/konto/registrieren/' });
  });

  app.post('/konto/registrieren/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!isSameOrigin(request)) return reply.code(403).send();
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success || !isStrongPassword(parsed.data.password)) {
      render(reply, 'account/auth.njk', {
        mode: 'register',
        error: 'Bitte eine gültige E-Mail-Adresse und ein Passwort mit mindestens 10 Zeichen eingeben.',
        currentPath: '/konto/registrieren/',
      });
      return;
    }
    await registerCustomer(parsed.data.email, parsed.data.password);
    render(reply, 'account/auth.njk', {
      mode: 'message',
      message: 'Wenn die Adresse registriert werden kann, haben wir eine Bestätigungs-E-Mail versendet.',
      currentPath: '/konto/registrieren/',
    });
  });

  app.get('/konto/bestaetigen/', async (request, reply) => {
    const token = typeof request.query === 'object' && request.query && 'token' in request.query
      ? String((request.query as { token?: unknown }).token ?? '')
      : '';
    const ok = token ? verifyEmail(token) || confirmEmailChange(token) : false;
    render(reply, 'account/auth.njk', {
      mode: 'message',
      message: ok ? 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' : 'Der Link ist ungültig oder abgelaufen.',
      currentPath: '/konto/bestaetigen/',
    });
  });

  app.get('/konto/anmelden/', async (_request, reply) => {
    render(reply, 'account/auth.njk', { mode: 'login', currentPath: '/konto/anmelden/' });
  });

  app.post('/konto/anmelden/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!isSameOrigin(request)) return reply.code(403).send();
    const parsed = loginSchema.safeParse(request.body);
    const sessionId = parsed.success ? await loginCustomer(parsed.data.email, parsed.data.password) : null;
    if (!sessionId) {
      render(reply, 'account/auth.njk', {
        mode: 'login',
        error: 'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        currentPath: '/konto/anmelden/',
      });
      return;
    }
    setCookie(reply, request, sessionId);
    return reply.redirect('/konto/', 303);
  });

  app.post('/konto/abmelden/', async (request, reply) => {
    const raw = request.cookies[CUSTOMER_COOKIE];
    if (raw) {
      const result = request.unsignCookie(raw);
      if (result.valid) deleteCustomerSession(result.value);
    }
    reply.clearCookie(CUSTOMER_COOKIE, { path: '/konto' });
    return reply.redirect('/konto/anmelden/', 303);
  });

  app.get('/konto/passwort-vergessen/', async (_request, reply) => {
    render(reply, 'account/auth.njk', { mode: 'forgot', currentPath: '/konto/passwort-vergessen/' });
  });

  app.post('/konto/passwort-vergessen/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!isSameOrigin(request)) return reply.code(403).send();
    const email = typeof (request.body as { email?: unknown })?.email === 'string' ? String((request.body as { email: string }).email) : '';
    if (email) requestPasswordReset(email);
    render(reply, 'account/auth.njk', {
      mode: 'message',
      message: 'Wenn ein Konto existiert, haben wir einen Link zum Zurücksetzen versendet.',
      currentPath: '/konto/passwort-vergessen/',
    });
  });

  app.get('/konto/neu-setzen/', async (request, reply) => {
    const token = typeof request.query === 'object' && request.query && 'token' in request.query
      ? String((request.query as { token?: unknown }).token ?? '')
      : '';
    render(reply, 'account/auth.njk', { mode: 'reset', token, currentPath: '/konto/neu-setzen/' });
  });

  app.post('/konto/neu-setzen/', async (request, reply) => {
    if (!isSameOrigin(request)) return reply.code(403).send();
    const parsed = resetSchema.safeParse(request.body);
    const ok = parsed.success && (await resetPassword(parsed.data.token, parsed.data.password));
    render(reply, 'account/auth.njk', {
      mode: 'message',
      message: ok ? 'Passwort gespeichert. Bitte melden Sie sich an.' : 'Der Link ist ungültig oder abgelaufen.',
      currentPath: '/konto/neu-setzen/',
    });
  });

  // Ab hier ist eine Kundensitzung nötig.
  app.addHook('preHandler', async (request, reply) => {
    const publicPaths = [
      '/konto/registrieren/',
      '/konto/anmelden/',
      '/konto/passwort-vergessen/',
      '/konto/neu-setzen/',
      '/konto/bestaetigen/',
      '/konto/abmelden/',
    ];
    if (!request.url.startsWith('/konto/') || publicPaths.some((path) => request.url.startsWith(path))) return;
    const raw = request.cookies[CUSTOMER_COOKIE];
    const result = raw ? request.unsignCookie(raw) : null;
    const session = result?.valid ? getCustomerSession(result.value) : null;
    if (!session) return reply.redirect('/konto/anmelden/', 303);
    request.customerSession = session;
    if (request.method !== 'GET' && request.method !== 'HEAD' && !verifyCustomerCsrf(session, (request.body as { _csrf?: unknown })?._csrf)) {
      return reply.code(403).send();
    }
    return undefined;
  });

  app.get('/konto/', async (request, reply) => {
    const session = request.customerSession!;
    const customer = getCustomerById(session.customerId)!;
    const orders = getDb().prepare('SELECT * FROM orders WHERE customer_id = ? OR lower(email) = ? ORDER BY id DESC LIMIT 20').all(customer.id, customer.email) as Record<string, unknown>[];
    render(reply, 'account/index.njk', authContext(request, session, { orders }));
  });

  app.get('/konto/bestellungen/', async (request, reply) => {
    const session = request.customerSession!;
    const customer = getCustomerById(session.customerId)!;
    const orders = getDb().prepare('SELECT * FROM orders WHERE customer_id = ? OR lower(email) = ? ORDER BY id DESC').all(customer.id, customer.email) as Record<string, unknown>[];
    render(reply, 'account/orders.njk', authContext(request, session, { orders }));
  });

  app.get<{ Params: { id: string } }>('/konto/rechnung/:id/', async (request, reply) => {
    const session = request.customerSession!;
    const id = Number.parseInt(request.params.id, 10);
    const order = Number.isInteger(id) ? ownOrder(request, reply, id, session) : null;
    if (!order || reply.sent) return;
    const stored = order as unknown as { invoice_url: string; invoice_date: string; invoice_updated_at: string | null; invoice_expires_at: string | null };
    const expires = stored.invoice_expires_at
      ? new Date(stored.invoice_expires_at.replace(' ', 'T') + 'Z').getTime()
      : stored.invoice_updated_at
        ? new Date(stored.invoice_updated_at.replace(' ', 'T') + 'Z').getTime() + 30 * 24 * 60 * 60 * 1000
        : 0;
    const expired = Boolean(stored.invoice_url && expires && expires < Date.now());
    render(reply, 'account/invoice.njk', authContext(request, session, {
      order: stored,
      expired,
      url: expired ? '' : stored.invoice_url,
    }));
  });

  app.get('/konto/anfragen/', async (request, reply) => {
    const session = request.customerSession!;
    const customer = getCustomerById(session.customerId)!;
    const quotes = getDb().prepare('SELECT * FROM quote_requests WHERE lower(email) = ? ORDER BY id DESC').all(customer.email) as Record<string, unknown>[];
    render(reply, 'account/quotes.njk', authContext(request, session, { quotes }));
  });

  app.get('/konto/daten/', async (request, reply) => {
    const session = request.customerSession!;
    const addresses = getDb().prepare('SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id').all(session.customerId) as Record<string, unknown>[];
    render(reply, 'account/data.njk', authContext(request, session, { addresses }));
  });

  app.post('/konto/daten/', async (request, reply) => {
    const session = request.customerSession!;
    const body = bodyObjectSafe(request.body);
    touchCustomer(session.customerId, {
      first_name: cleanText(body.firstName, 100),
      last_name: cleanText(body.lastName, 100),
      company: cleanText(body.company, 100),
      phone: cleanText(body.phone, 100),
      marketing_consent: body.marketingConsent === '1' ? 1 : 0,
    });
    if (typeof body.newEmail === 'string' && body.newEmail.includes('@')) requestEmailChange(session.customerId, body.newEmail);
    return reply.redirect('/konto/daten/?gespeichert=1', 303);
  });

  app.get('/konto/export/', async (request, reply) => {
    const session = request.customerSession!;
    const customer = getCustomerById(session.customerId)!;
    const orders = getDb().prepare('SELECT * FROM orders WHERE customer_id = ? OR lower(email) = ? ORDER BY id').all(customer.id, customer.email) as Record<string, unknown>[];
    const json = JSON.stringify({ customer, orders }, null, 2);
    return reply.type('application/json').header('Content-Disposition', 'attachment; filename="3d-mir-meine-daten.json"').send(json);
  });

  app.post('/konto/loeschen/', async (request, reply) => {
    const session = request.customerSession!;
    const body = bodyObjectSafe(request.body);
    if (cleanText(body.confirm, 20) !== 'LOESCHEN') return reply.redirect('/konto/daten/?fehler=1', 303);
    anonymizeCustomer(session.customerId);
    deleteAllForCustomer(session.customerId);
    reply.clearCookie(CUSTOMER_COOKIE, { path: '/konto' });
    return reply.redirect('/konto/anmelden/', 303);
  });
}

function bodyObjectSafe(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function deleteAllForCustomer(customerId: string): void {
  getDb().prepare('DELETE FROM customer_sessions WHERE customer_id = ?').run(customerId);
  getDb().prepare('DELETE FROM customer_auth_tokens WHERE customer_id = ?').run(customerId);
}
