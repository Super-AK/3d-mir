import type { AdminSession, AdminUser } from '../lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminUser;
    adminSession?: AdminSession;
    /** Unveränderter Request-Body, z. B. für die Stripe-Signaturprüfung. */
    rawBody?: Buffer;
  }
}
