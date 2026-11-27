import type { FastifyInstance } from 'fastify';
import { render } from '../lib/render.js';
import { isSameOrigin } from '../lib/http.js';
import { confirmNewsletter, subscribeNewsletter, unsubscribeNewsletter } from '../lib/newsletter.js';
import { verifyTurnstileToken, turnstileToken } from '../lib/turnstile.js';
import { recordBotEvent } from '../lib/bot-events.js';

function tokenFrom(query: unknown): string {
  if (!query || typeof query !== 'object' || !('token' in query)) return '';
  const value = (query as { token?: unknown }).token;
  return typeof value === 'string' ? value : '';
}

export async function newsletterRoutes(app: FastifyInstance): Promise<void> {
  app.get('/newsletter/', async (_request, reply) => {
    render(reply, 'pages/newsletter.njk', { mode: 'form' });
  });

  app.post('/newsletter/', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!isSameOrigin(request)) return reply.code(403).send();
    const body = (request.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email : '';
    const ok = await verifyTurnstileToken(turnstileToken(body));
    if (body.consent === '1') {
      if (ok) await subscribeNewsletter(email);
      else recordBotEvent({
        form: '/newsletter/',
        reason: 'Turnstile abgelehnt',
        ip: request.ip,
        details: 'Anmeldung ohne gültiges Token verworfen – kein Eintrag angelegt',
      });
    }
    render(reply, 'pages/newsletter.njk', {
      mode: 'message',
      message: 'Wenn die Anmeldung möglich ist, haben wir eine Bestätigungs-E-Mail versendet.',
    });
  });

  app.get('/newsletter/bestaetigen/', async (request, reply) => {
    const ok = confirmNewsletter(tokenFrom(request.query));
    render(reply, 'pages/newsletter.njk', {
      mode: 'message',
      message: ok
        ? 'Newsletter-Anmeldung bestätigt. Sie erhalten künftig unsere E-Mails.'
        : 'Der Bestätigungslink ist ungültig oder bereits benutzt.',
    });
  });

  app.get('/newsletter/abmelden/', async (request, reply) => {
    const ok = unsubscribeNewsletter(tokenFrom(request.query));
    render(reply, 'pages/newsletter.njk', {
      mode: 'message',
      message: ok ? 'Sie sind vom Newsletter abgemeldet.' : 'Der Abmeldelink ist ungültig.',
    });
  });
}
