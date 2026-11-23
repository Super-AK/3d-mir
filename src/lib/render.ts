import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { config } from '../config.js';
import { assetCss, assetUrl } from './assets.js';
import { cartCount, readCart } from './cart.js';
import { getPricingConfig } from './pricing-config.js';
import { getPublicPaymentMethods } from './shop-settings.js';
import { getPublicationSettings } from './publication-settings.js';
import { placeholder } from './placeholders.js';
import { isPickupShippingMethod } from './shop.js';
import { faviconVersion } from './favicon.js';

type ImageVariant = { width: number; avif: string; webp: string; jpg: string };
type ImageInfo = { width: number; height: number; alt: string; variants: ImageVariant[] };
type ImageManifest = Record<string, ImageInfo>;
type UploadedImageInfo = { width: number; height: number; variants: { width: number }[] };

let imageManifest: ImageManifest | null = null;

function loadImageManifest(): ImageManifest {
  if (imageManifest) return imageManifest;
  const file = path.join(config.root, 'web', 'static', 'img', 'gen', 'manifest.json');
  imageManifest = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as ImageManifest) : {};
  return imageManifest;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type ImageOptions = {
  sizes?: string;
  class?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  alt?: string;
};

/** Erzeugt ein responsives `<picture>`-Element aus den vorbereiteten Bildvarianten. */
export function image(name: string, options: ImageOptions = {}): string {
  if (name.startsWith(UPLOAD_PREFIX)) {
    return uploadedImage(name.slice(UPLOAD_PREFIX.length), options);
  }
  const info = loadImageManifest()[name];
  if (!info || info.variants.length === 0) return '';
  const variants = info.variants;
  const srcset = (format: 'avif' | 'webp' | 'jpg') =>
    variants.map((variant) => `${variant[format]} ${variant.width}w`).join(', ');
  const largest = variants[variants.length - 1]!;
  const alt = escapeHtml(options.alt ?? info.alt ?? '');
  const cls = options.class ? ` class="${escapeHtml(options.class)}"` : '';
  const sizes = options.sizes ?? '100vw';
  const loading = options.priority ? 'eager' : (options.loading ?? 'lazy');
  const priority = options.priority ? ' fetchpriority="high"' : '';
  return `<picture>
  <source type="image/avif" srcset="${srcset('avif')}" sizes="${escapeHtml(sizes)}">
  <source type="image/webp" srcset="${srcset('webp')}" sizes="${escapeHtml(sizes)}">
  <img src="${largest.jpg}" srcset="${srcset('jpg')}" sizes="${escapeHtml(sizes)}" width="${info.width}" height="${info.height}" alt="${alt}"${cls} loading="${loading}" decoding="async"${priority}>
</picture>`;
}

/** Präfix in `product_images.file` für im Admin hochgeladene Bilder. */
export const UPLOAD_PREFIX = 'upload:';

const mediaRoot = () => path.join(config.uploadDir, 'media');

function uploadedImageFile(key: string): string | null {
  const root = path.resolve(mediaRoot());
  const file = path.resolve(root, key);
  if (!file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

function loadUploadedImage(key: string): UploadedImageInfo | null {
  const file = uploadedImageFile(key);
  if (!file) return null;
  const metaFile = `${file}.json`;
  if (!fs.existsSync(metaFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as UploadedImageInfo;
    if (!parsed || !Array.isArray(parsed.variants) || parsed.variants.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function uploadUrl(key: string, width: number, format: 'avif' | 'webp' | 'jpg'): string {
  return `/media/${key}-${width}.${format}`;
}

function uploadedImage(key: string, options: ImageOptions): string {
  const info = loadUploadedImage(key);
  if (!info) return '';
  const variants = info.variants.filter((variant) => Number.isFinite(variant.width) && variant.width > 0);
  if (variants.length === 0) return '';
  const srcset = (format: 'avif' | 'webp' | 'jpg') =>
    variants.map((variant) => `${uploadUrl(key, variant.width, format)} ${variant.width}w`).join(', ');
  const largestWidth = variants[variants.length - 1]!.width;
  const alt = escapeHtml(options.alt ?? '');
  const cls = options.class ? ` class="${escapeHtml(options.class)}"` : '';
  const sizes = options.sizes ?? '100vw';
  const loading = options.priority ? 'eager' : (options.loading ?? 'lazy');
  const priority = options.priority ? ' fetchpriority="high"' : '';
  return `<picture>
  <source type="image/avif" srcset="${srcset('avif')}" sizes="${escapeHtml(sizes)}">
  <source type="image/webp" srcset="${srcset('webp')}" sizes="${escapeHtml(sizes)}">
  <img src="${uploadUrl(key, largestWidth, 'jpg')}" srcset="${srcset('jpg')}" sizes="${escapeHtml(sizes)}" width="${info.width}" height="${info.height}" alt="${alt}"${cls} loading="${loading}" decoding="async"${priority}>
</picture>`;
}

/** Vorschaubild für Admin-Listen – funktioniert für Manifest- und Upload-Bilder. */
/**
 * Lesbare Quelldatei eines Bildes für die Bearbeitung im Admin.
 *
 * Bei hochgeladenen Bildern wird das gespeicherte Original bevorzugt. Ältere
 * Uploads ohne Original nutzen die größte JPG-Variante, Stammdatenbilder die
 * größte Variante aus dem Manifest.
 */
export function imageSourceFile(name: string): string | null {
  if (name.startsWith(UPLOAD_PREFIX)) {
    const key = name.slice(UPLOAD_PREFIX.length);
    const root = path.resolve(config.uploadDir, 'media');
    const base = path.resolve(root, key);
    if (!base.startsWith(`${root}${path.sep}`)) return null;
    const source = `${base}.source`;
    if (fs.existsSync(source)) return source;
    const info = loadUploadedImage(key);
    const largest = info?.variants[info.variants.length - 1];
    if (!largest) return null;
    const variant = `${base}-${largest.width}.jpg`;
    return fs.existsSync(variant) ? variant : null;
  }
  const info = loadImageManifest()[name];
  const largest = info?.variants[info.variants.length - 1];
  if (!largest) return null;
  const file = path.join(config.root, 'web', 'static', largest.jpg.replace(/^\//, ''));
  return fs.existsSync(file) ? file : null;
}

export function imagePreview(name: string, width = 480): string {
  if (name.startsWith(UPLOAD_PREFIX)) {
    const key = name.slice(UPLOAD_PREFIX.length);
    const info = loadUploadedImage(key);
    if (!info) return '';
    const variant = info.variants.find((item) => item.width >= width) ?? info.variants[info.variants.length - 1];
    return variant ? uploadUrl(key, variant.width, 'jpg') : '';
  }
  const info = loadImageManifest()[name];
  if (!info || info.variants.length === 0) return '';
  const variant = info.variants.find((item) => item.width >= width) ?? info.variants[info.variants.length - 1];
  return variant?.jpg ?? '';
}

/** Kleines Galerie-Vorschaubild mit AVIF/WebP-Quellen für Miniaturen. */
export function imageThumbnail(name: string, width = 160): string {
  let sources: { avif: string; webp: string; jpg: string } | null = null;

  if (name.startsWith(UPLOAD_PREFIX)) {
    const key = name.slice(UPLOAD_PREFIX.length);
    const info = loadUploadedImage(key);
    if (info) {
      const variant = info.variants.find((item) => item.width >= width) ?? info.variants[info.variants.length - 1];
      if (variant) {
        sources = {
          avif: uploadUrl(key, variant.width, 'avif'),
          webp: uploadUrl(key, variant.width, 'webp'),
          jpg: uploadUrl(key, variant.width, 'jpg'),
        };
      }
    }
  } else {
    const info = loadImageManifest()[name];
    if (info && info.variants.length > 0) {
      const variant = info.variants.find((item) => item.width >= width) ?? info.variants[info.variants.length - 1];
      if (variant) sources = { avif: variant.avif, webp: variant.webp, jpg: variant.jpg };
    }
  }

  if (!sources) return '';
  return `<picture>
  <source type="image/avif" srcset="${sources.avif}">
  <source type="image/webp" srcset="${sources.webp}">
  <img src="${sources.jpg}" width="64" height="64" alt="" loading="lazy" decoding="async">
</picture>`;
}

export type RenderContext = Record<string, unknown>;

const env = nunjucks.configure(path.join(config.root, 'src', 'templates'), {
  autoescape: true,
  noCache: !config.isProduction,
  watch: !config.isProduction,
  throwOnUndefined: false,
});

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

env.addFilter('price', (cents: number | null | undefined) => (cents == null ? '' : eur.format(cents / 100)));
/** Formatiert einen Betrag in Euro (nicht Cent), z. B. Versandkosten aus der Konfiguration. */
env.addFilter('euro', (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? '' : eur.format(Number(value)),
);
env.addFilter('number', (value: number | null | undefined, digits = 2) =>
  value == null
    ? ''
    : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value),
);
env.addFilter('date', (value: string | Date | null | undefined) => {
  if (!value) return '';
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else {
    // SQLite liefert "YYYY-MM-DD HH:MM:SS" in UTC.
    const iso = value.includes('T') ? value : value.replace(' ', 'T');
    d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  }
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(d);
});
env.addFilter('datetime', (value: string | Date | null | undefined) => {
  if (!value) return '';
  const iso = value instanceof Date
    ? value.toISOString()
    : value.includes('T')
      ? value
      : value.replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
});
env.addFilter('json', (value: unknown) => JSON.stringify(value));
env.addFilter('jsonld', (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c'));
/** Wandelt Klartext mit Leerzeilen in sichere Absätze um. */
env.addFilter('paragraphs', (value: unknown) => {
  const text = typeof value === 'string' ? value : '';
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll('\n', '<br>')}</p>`)
    .join('');
});

env.addGlobal('site', config.site);
env.addGlobal('shopConfig', config.shop);
env.addGlobal('features', config.site.features);
env.addGlobal('year', new Date().getFullYear());
env.addGlobal('asset', assetUrl);
env.addGlobal('assetCss', assetCss);
env.addGlobal('image', image);
env.addGlobal('imagePreview', imagePreview);
env.addGlobal('imageThumbnail', imageThumbnail);
env.addGlobal('maxUploadMb', Math.round(config.maxUploadBytes / (1024 * 1024)));
env.addGlobal('placeholder', placeholder);
env.addGlobal('isPickupShipping', isPickupShippingMethod);

export function render(res: import('fastify').FastifyReply, template: string, context: RenderContext = {}): void {
  const pricing = getPricingConfig();
  // Abholung (0 €) zählt mit: Der günstigste Versandweg ist dann 0 €.
  const shippingPrices = pricing.shipping.methods
    .filter((method) => method.active !== false)
    .map((method) => method.price);
  const paymentMethods = getPublicPaymentMethods();
  const html = env.render(template, {
    currentPath: res.request.url.split('?')[0] ?? '/',
    cartCount: cartCount(readCart(res.request)),
    pricing,
    publication: getPublicationSettings(),
    publicPaymentMethods: paymentMethods,
    faviconVersion: faviconVersion(),
    publicPaymentFlags: {
      card: paymentMethods.some((method) => method.provider === 'stripe' && method.stripeMethod === 'card'),
      paypal: paymentMethods.some((method) => method.stripeMethod === 'paypal'),
      amazonPay: paymentMethods.some((method) => method.stripeMethod === 'amazon_pay'),
      klarna: paymentMethods.some((method) => method.stripeMethod === 'klarna'),
      ideal: paymentMethods.some((method) => method.stripeMethod === 'ideal'),
      stripe: paymentMethods.some((method) => method.provider === 'stripe'),
    },
    galleryImages:
      config.site.images.gallery === null
        ? ['gallery-1', 'gallery-2', 'gallery-3', 'gallery-4', 'gallery-5', 'gallery-6', 'gallery-7', 'gallery-8']
        : config.site.images.gallery,
    galleryAlts: config.site.images.galleryAlt,
    shippingFromPrice: shippingPrices.length > 0 ? Math.min(...shippingPrices) : null,
    ...context,
  });
  res.type('text/html; charset=utf-8').send(html);
}

export { env as nunjucksEnv };
