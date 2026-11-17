import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import 'dotenv/config';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
/** Projektwurzel – funktioniert sowohl aus `src/` (tsx) als auch aus `dist/` (Build). */
export const ROOT = path.resolve(moduleDir, '..');

function readJson<T>(file: string): T {
  const full = path.join(ROOT, file);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_DIR: z.string().default('/var/lib/3d-mir'),
  LOG_DIR: z.string().default('/var/log/3d-mir'),
  DB_PATH: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  TRUST_PROXY: z.string().default('127.0.0.1'),
  // Lokale GeoIP-Datenbank (MaxMind-Format, z. B. DB-IP Lite) für die Länderprüfung.
  GEOIP_DB_PATH: z.string().optional(),
  // Optionaler Länder-Header eines vorgeschalteten CDN. Leer = Header werden ignoriert.
  COUNTRY_HEADER: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('3D-MIR <info@3d-mir.de>'),
  MAIL_TO: z.string().default('info@3d-mir.de'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),
  // Stripe: Geheimnisse ausschließlich über die Umgebung, nie im Repository.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_MODE: z.enum(['test', 'live']).default('test'),
  STRIPE_API_BASE: z.string().url().default('https://api.stripe.com'),
  // Öffentliche Basis-URL für Rückleitungen aus dem Zahlungsanbieter.
  PAYMENT_BASE_URL: z.string().optional(),
  // Admin-Benachrichtigungen: Mail, Telegram oder beides.
  NOTIFICATION_CHANNEL: z.enum(['mail', 'telegram', 'both']).default('mail'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // Passkeys (WebAuthn): Standard ist Domain/Origin aus config/site.json.
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Ungültige Umgebungsvariablen:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;
const site = readJson<SiteConfig>('config/site.json');
const pricing = readJson<PricingConfig>('config/pricing.json');
const shop = readJson<ShopConfig>('config/shop.json');
const packageJson = readJson<{ version?: string }>('package.json');

if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
  console.error('FEHLER: SESSION_SECRET muss in Produktion gesetzt sein (siehe .env.example).');
  process.exit(1);
}

const paymentBaseUrl = (env.PAYMENT_BASE_URL?.trim() || site.baseUrl).replace(/\/+$/, '');

export const config = {
  version: packageJson.version ?? '0.0.0',
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  host: env.HOST,
  port: env.PORT,
  root: ROOT,
  dataDir: env.DATA_DIR,
  logDir: env.LOG_DIR,
  dbPath: env.DB_PATH ?? path.join(env.DATA_DIR, 'db', '3d-mir.sqlite'),
  uploadDir: env.UPLOAD_DIR ?? path.join(env.DATA_DIR, 'uploads'),
  sessionSecret: env.SESSION_SECRET ?? 'entwicklung-nur-nicht-produktiv-bitte-aendern',
  trustProxy: env.TRUST_PROXY.trim() || '127.0.0.1',
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  geoip: {
    dbPath: env.GEOIP_DB_PATH?.trim() || path.join(env.DATA_DIR, 'geoip', 'dbip-country-lite.mmdb'),
    countryHeader: (env.COUNTRY_HEADER ?? '').trim().toLowerCase(),
  },
  mail: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
    to: env.MAIL_TO,
  },
  payment: {
    baseUrl: paymentBaseUrl,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
    mode: env.STRIPE_MODE,
    apiBase: env.STRIPE_API_BASE.replace(/\/+$/, ''),
  },
  notifications: {
    channel: env.NOTIFICATION_CHANNEL,
    telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: env.TELEGRAM_CHAT_ID ?? '',
  },
  site,
  pricing,
  shop,
} as const;

const siteUrl = new URL(site.baseUrl);
export const webauthn = {
  rpId: env.WEBAUTHN_RP_ID ?? siteUrl.hostname,
  origin: env.WEBAUTHN_ORIGIN ?? siteUrl.origin,
  rpName: '3D-MIR Admin',
} as const;

export type SiteConfig = {
  baseUrl: string;
  locale: string;
  business: {
    name: string;
    legalName: string;
    owner: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    countryCode: string;
    phone: string;
    phoneHref: string;
    email: string;
    vatNote: string;
    smallBusiness: boolean;
  };
  channels: {
    etsy: { label: string; url: string; reviewsUrl: string };
    classifieds: { label: string; url: string };
  };
  contact: { responseTime: string; appointmentNote: string };
  seo: { siteName: string; defaultTitle: string; defaultDescription: string };
  images: { logo: string; favicon: string; hero: string; service: string; materials: string; calculator: string; gallery: string[] | null; galleryAlt: Record<string, string> };
  features: { shop: boolean; customerAccounts: boolean; calculator: boolean; paypal: boolean; totp: boolean };
  legal: { lastUpdated: string; reviewNotice: string; showDraftNotice: boolean };
};

export type Material = {
  id: string;
  label: string;
  density: number;
  pricePerGram: number;
  maxTempC: number;
  colors: string[];
  properties: string;
  useCases: string;
  notes: string;
  active?: boolean;
};

export type Printer = {
  id: string;
  label: string;
  buildVolume: { x: number; y: number; z: number };
  hourlyRate: number;
  materialIds: string[];
  note: string;
  active?: boolean;
};

export type PricingConfig = {
  meta: {
    status: string;
    hinweis: string;
    currency: string;
    currencySymbol: string;
    roundTo: number;
    minOrderValue: number;
    setupFee: number;
    setupFeePerExtraPart: number;
    vatIncluded: boolean;
    estimateDisclaimer: string;
  };
  calculation: {
    status: string;
    hinweis: string;
    wallThicknessMm: number;
    materialCm3PerHour: number;
    wastePercent: number;
  };
  materials: Material[];
  printers: Printer[];
  infillOptions: number[];
  layerHeightOptions: number[];
  coatings: { id: string; label: string; surchargePercent: number; pricePerPart: number; active?: boolean }[];
  quantityDiscounts: { minQuantity: number; percent: number }[];
  shipping: {
    status: string;
    note: string;
    methods: { id: string; label: string; price: number; deliveryDays: string; note: string; active?: boolean }[];
    options: { id: string; label: string; price: number; note: string; active?: boolean }[];
    freeShippingFrom: number;
  };
};

export type ShopConfig = {
  status: string;
  notice: string;
  maxQuantityPerItem: number;
  payment: {
    status: string;
    note: string;
    methods: {
      id: string;
      provider?: 'manual' | 'stripe';
      stripeMethod?: string;
      label: string;
      note: string;
      enabled?: boolean;
      sortOrder?: number;
    }[];
  };
  checkout: {
    acceptedCountries: string[];
    legalNote: string;
    termsVersion: string;
  };
};
