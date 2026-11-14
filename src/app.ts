import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { getLogger } from './lib/logger.js';
import { render } from './lib/render.js';
import { publicRoutes } from './routes/public.js';
import { calculatorRoutes } from './routes/calculator.js';
import { shopRoutes } from './routes/shop.js';
import { paymentRoutes } from './routes/payments.js';
import { adminRoutes } from './routes/admin.js';
import { migrate } from './db/migrate.js';
import { applySiteSettings } from './lib/site-settings.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // Stripe Checkout wird nach dem Formular-POST per 303 angesprungen.
  "form-action 'self' https://checkout.stripe.com https://pay.stripe.com",
  "frame-ancestors 'none'",
].join('; ');

export async function buildApp() {
  const app = Fastify({
    loggerInstance: getLogger(),
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
    // Produkt-Slugs können lang sein (z. B. aus Etsy-Importen).
    routerOptions: { maxParamLength: 300 },
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(formbody);
  // Rohbody für die Stripe-Signaturprüfung aufbewahren; JSON wird weiterhin normal geparst.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    request.rawBody = raw;
    try {
      done(null, raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {});
    } catch (error) {
      done(error as Error, undefined);
    }
  });
  // Standardmäßig kein globales Limit; nur sensible Routen (z. B. Kontaktformular) begrenzen sich selbst.
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadBytes,
      files: 1,
      fields: 25,
      parts: 30,
    },
  });

  const assetsDir = path.join(config.root, 'public', 'assets');
  if (fs.existsSync(assetsDir)) {
    await app.register(fastifyStatic, {
      root: assetsDir,
      prefix: '/assets/',
      decorateReply: false,
      maxAge: config.isProduction ? '7d' : 0,
      immutable: false,
    });
  }

  // Produktbilder aus dem Upload-Verzeichnis (nur der Medien-Unterordner,
  // damit hochgeladene 3D-Modelle nicht öffentlich erreichbar sind).
  const mediaDir = path.join(config.uploadDir, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: mediaDir,
    prefix: '/media/',
    decorateReply: false,
    maxAge: '30d',
    immutable: true,
  });

  // Stammdaten-Bilder (Logo) aus dem Upload-Verzeichnis.
  const siteMediaDir = path.join(config.uploadDir, 'site');
  fs.mkdirSync(siteMediaDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: siteMediaDir,
    prefix: '/site-media/',
    decorateReply: false,
    maxAge: '7d',
    immutable: false,
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Content-Security-Policy', CSP);
    if (_request.protocol === 'https') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (_request.url.startsWith('/admin')) {
      reply.header('X-Robots-Tag', 'noindex, nofollow');
    }
    return payload;
  });

  await app.register(publicRoutes);
  await app.register(calculatorRoutes);
  await app.register(shopRoutes);
  await app.register(paymentRoutes);
  await app.register(adminRoutes);

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not_found', message: 'Nicht gefunden' });
    }

    // Reste der alten WordPress-Installation dauerhaft umleiten.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const path = request.url.split('?')[0] ?? '';
      const legacy: [prefix: string, target: string][] = [
        ['/wp-json/', '/'],
        ['/wp-admin/', '/admin/'],
        ['/wp-sitemap-posts-', '/sitemap.xml'],
      ];
      const match = legacy.find(([prefix]) => path.startsWith(prefix));
      if (match) return reply.redirect(match[1], 301);
    }

    reply.code(404);
    return render(reply, 'pages/error.njk', {
      statusCode: 404,
      title: 'Seite nicht gefunden',
      message: 'Die aufgerufene Seite existiert nicht oder wurde verschoben.',
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Unbehandelter Fehler');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (request.url.startsWith('/api/')) {
      return reply.code(status).send({ error: 'server_error', message: 'Interner Fehler' });
    }
    reply.code(status);
    return render(reply, 'pages/error.njk', {
      statusCode: status,
      title: status === 500 ? 'Es ist ein Fehler aufgetreten' : 'Anfrage fehlgeschlagen',
      message: 'Bitte versuchen Sie es später erneut. Wenn das Problem bleibt, schreiben Sie uns eine E-Mail.',
    });
  });

  // Migrationen beim Start ausführen (idempotent).
  migrate();
  // Im Admin gespeicherte Stammdaten über die Dateiwerte legen.
  applySiteSettings();

  return app;
}
