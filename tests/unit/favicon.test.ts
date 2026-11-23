import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import { faviconIco, faviconManifest, faviconPng, faviconVersion } from '../../src/lib/favicon.js';

const originalFavicon = config.site.images.favicon;

function pngSize(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('Favicon-Auslieferung', () => {
  beforeEach(() => {
    config.site.images.favicon = '';
  });

  afterAll(() => {
    config.site.images.favicon = originalFavicon;
  });

  it('liefert PNGs in den benötigten Größen', async () => {
    for (const size of [180, 192, 512]) {
      const png = await faviconPng(size);
      expect(png).not.toBeNull();
      expect(pngSize(png!)).toEqual({ width: size, height: size });
    }
  });

  it('erzeugt ein echtes ICO mit drei Rahmengrößen', async () => {
    const ico = await faviconIco();
    expect(ico).not.toBeNull();
    expect(ico!.readUInt16LE(0)).toBe(0); // reserviert
    expect(ico!.readUInt16LE(2)).toBe(1); // Typ Icon
    expect(ico!.readUInt16LE(4)).toBe(3); // 16/32/48 px
    expect(ico!.readUInt8(6)).toBe(16);
    expect(ico!.readUInt8(22)).toBe(32);
    expect(ico!.readUInt8(38)).toBe(48);
  });

  it('verweist im Webmanifest auf die dynamischen Symbole', () => {
    const manifest = faviconManifest() as {
      icons: { src: string; sizes: string; type: string }[];
    };
    expect(manifest.icons).toEqual([
      { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    ]);
  });

  it('nutzt den Dateinamen des hinterlegten Favicons als Cache-Busting-Wert', () => {
    config.site.images.favicon = '/site-media/favicon-abc123.png';
    expect(faviconVersion()).toBe('favicon-abc123.png');
    const manifest = faviconManifest() as { icons: { src: string }[] };
    expect(manifest.icons[0]!.src).toContain('?v=favicon-abc123.png');
  });
});
