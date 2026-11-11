import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { config } from '../config.js';
import { assetCss, assetUrl } from './assets.js';

type ImageVariant = { width: number; avif: string; webp: string; jpg: string };
type ImageInfo = { width: number; height: number; alt: string; variants: ImageVariant[] };
type ImageManifest = Record<string, ImageInfo>;

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
  const info = loadImageManifest()[name];
  if (!info || info.variants.length === 0) return '';
  const variants = info.variants;
  const srcset = (format: 'avif' | 'webp' | 'jpg') =>
    variants.map((variant) => `${variant[format]} ${variant.width}w`).join(', ');
  const largest = variants[variants.length - 1]!;
  const alt = escapeHtml(options.alt ?? info.alt ?? '');
  const cls = options.class ? ` class="${escapeHtml(options.class)}"` : '';
  const sizes = options.sizes ?? '100vw';
  const loading = options.loading ?? 'lazy';
  const priority = options.priority ? ' fetchpriority="high"' : '';
  return `<picture>
  <source type="image/avif" srcset="${srcset('avif')}" sizes="${escapeHtml(sizes)}">
  <source type="image/webp" srcset="${srcset('webp')}" sizes="${escapeHtml(sizes)}">
  <img src="${largest.jpg}" srcset="${srcset('jpg')}" sizes="${escapeHtml(sizes)}" width="${info.width}" height="${info.height}" alt="${alt}"${cls} loading="${loading}" decoding="async"${priority}>
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
env.addFilter('json', (value: unknown) => JSON.stringify(value));
env.addFilter('jsonld', (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c'));

env.addGlobal('site', config.site);
env.addGlobal('pricing', config.pricing);
env.addGlobal('features', config.site.features);
env.addGlobal('year', new Date().getFullYear());
env.addGlobal('asset', assetUrl);
env.addGlobal('assetCss', assetCss);
env.addGlobal('image', image);
env.addGlobal('maxUploadMb', Math.round(config.maxUploadBytes / (1024 * 1024)));

export function render(res: import('fastify').FastifyReply, template: string, context: RenderContext = {}): void {
  const html = env.render(template, {
    currentPath: res.request.url.split('?')[0] ?? '/',
    ...context,
  });
  res.type('text/html; charset=utf-8').send(html);
}

export { env as nunjucksEnv };
