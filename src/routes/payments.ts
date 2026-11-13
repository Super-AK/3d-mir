import type { FastifyInstance } from 'fastify';
import { applyStripeEvent } from '../lib/payments/index.js';
import { StripeError, verifyStripeWebhook } from '../lib/payments/stripe.js';

/**
 * Server-zu-Server-Endpunkt für Stripe.
 *
 * Die Route ist bewusst ohne CSRF-/Origin-Prüfung, dafür mit
 * Signaturprüfung und Idempotenz über die Stripe-Event-ID.
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/zahlung/webhook/stripe/', { config: { rateLimit: false } }, async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      return reply.code(400).send({ error: 'missing_signature' });
    }
    if (!request.rawBody) {
      return reply.code(400).send({ error: 'missing_body' });
    }

    try {
      const event = verifyStripeWebhook(request.rawBody, signature);
      const result = await applyStripeEvent(event);
      request.log.info(
        {
          event: event.id,
          type: event.type,
          changed: result.changed,
          orderId: result.orderId,
          duplicate: result.duplicate === true,
        },
        'Stripe-Webhook verarbeitet',
      );
      return reply.send({ received: true });
    } catch (error) {
      if (error instanceof StripeError) {
        request.log.warn({ err: error }, 'Stripe-Webhook abgelehnt');
        return reply.code(400).send({ error: 'invalid_webhook' });
      }
      request.log.error({ err: error }, 'Stripe-Webhook konnte nicht verarbeitet werden');
      return reply.code(500).send({ error: 'processing_failed' });
    }
  });
}
