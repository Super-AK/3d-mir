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
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('3D-MIR <info@3d-mir.de>'),
  MAIL_TO: z.string().default('info@3d-mir.de'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(50),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Ungültige Umgebungsvariablen:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

if (env.NODE_ENV === 'production' && !env.SESSION_SECRET) {
  console.error('FEHLER: SESSION_SECRET muss in Produktion gesetzt sein (siehe .env.example).');
  process.exit(1);
}

export const config = {
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
  trustProxy: env.TRUST_PROXY,
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  mail: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
    to: env.MAIL_TO,
  },
  site: readJson<SiteConfig>('config/site.json'),
  pricing: readJson<PricingConfig>('config/pricing.json'),
  shop: readJson<ShopConfig>('config/shop.json'),
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
    methods: { id: string; label: string; price: number; deliveryDays: string; active?: boolean }[];
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
    methods: { id: string; label: string; note: string }[];
  };
  checkout: {
    acceptedCountries: string[];
    legalNote: string;
    termsVersion: string;
  };
};
