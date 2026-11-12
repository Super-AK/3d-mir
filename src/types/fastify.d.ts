import type { AdminSession, AdminUser } from '../lib/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminUser;
    adminSession?: AdminSession;
  }
}
