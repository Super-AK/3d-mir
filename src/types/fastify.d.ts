import type { AdminSession, AdminUser } from '../lib/auth.js';
import type { ResolvedApiToken } from '../lib/api-auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminUser;
    adminSession?: AdminSession;
    /** Unveränderter Request-Body, z. B. für die Stripe-Signaturprüfung. */
    rawBody?: Buffer;
    apiRequestId?: string;
    apiToken?: ResolvedApiToken | null;
    apiItemCount?: number;
    apiForwardedFor?: string;
    customerSession?: import('../lib/customer-auth.js').CustomerSession;
  }
}
