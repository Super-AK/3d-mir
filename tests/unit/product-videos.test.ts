import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import {
  MAX_PRODUCT_VIDEO_BYTES,
  ProductVideoError,
  deleteProductVideoFile,
  productVideoUrl,
  storeProductVideo,
} from '../../src/lib/product-videos.js';

const originalUploadDir = config.uploadDir;
let tempDir: string;

const mp4 = () => Buffer.concat([Buffer.from('000000186674797069736f6d', 'hex'), Buffer.alloc(32)]);
const webm = () => Buffer.concat([Buffer.from('1a45dfa3', 'hex'), Buffer.alloc(32)]);

describe('Produktvideos', () => {
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3dmir-videos-'));
    config.uploadDir = tempDir;
  });

  afterAll(() => {
    config.uploadDir = originalUploadDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('speichert gültige MP4- und WebM-Dateien mit zufälligem Schlüssel', () => {
    const mp4Key = storeProductVideo({ buffer: mp4(), filename: 'video.mp4', mimetype: 'video/mp4' });
    const webmKey = storeProductVideo({ buffer: webm(), filename: 'video.webm', mimetype: 'video/webm' });

    expect(mp4Key).toMatch(/^video-[a-f0-9]{24}\.mp4$/);
    expect(webmKey).toMatch(/^video-[a-f0-9]{24}\.webm$/);
    expect(mp4Key).not.toBe(webmKey);
    expect(productVideoUrl(mp4Key)).toBe(`/media/videos/${mp4Key}`);
    expect(fs.existsSync(path.join(tempDir, 'media', 'videos', mp4Key))).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'media', 'videos', webmKey)).length).toBe(webm().length);
  });

  it('lehnt falsche MIME-Typen, leere und zu große Dateien ab', () => {
    expect(() => storeProductVideo({ buffer: mp4(), filename: 'x.mov', mimetype: 'video/quicktime' })).toThrow(
      ProductVideoError,
    );
    expect(() => storeProductVideo({ buffer: Buffer.alloc(0), filename: 'x.mp4', mimetype: 'video/mp4' })).toThrow(
      /leer/,
    );
    expect(() =>
      storeProductVideo({
        buffer: Buffer.alloc(MAX_PRODUCT_VIDEO_BYTES + 1),
        filename: 'x.mp4',
        mimetype: 'video/mp4',
      }),
    ).toThrow(/zu groß/);
  });

  it('akzeptiert Dateien über dem alten 25-MB-Limit bis 35 MB', () => {
    const bigger = Buffer.concat([
      Buffer.from('000000186674797069736f6d', 'hex'),
      Buffer.alloc(26 * 1024 * 1024),
    ]);
    const key = storeProductVideo({ buffer: bigger, filename: 'gross.mp4', mimetype: 'video/mp4' });
    expect(fs.statSync(path.join(tempDir, 'media', 'videos', key)).size).toBe(bigger.length);
  });

  it('prüft die Magic Bytes unabhängig vom MIME-Typ', () => {
    expect(() =>
      storeProductVideo({ buffer: Buffer.from('kein video'), filename: 'x.mp4', mimetype: 'video/mp4' }),
    ).toThrow(/kein gültiges Video-Format/);
    expect(() =>
      storeProductVideo({ buffer: mp4(), filename: 'x.webm', mimetype: 'video/webm' }),
    ).toThrow(/kein gültiges Video-Format/);
  });

  it('löscht nur Dateien mit gültigem Schlüssel', () => {
    const key = storeProductVideo({ buffer: mp4(), filename: 'x.mp4', mimetype: 'video/mp4' });
    const file = path.join(tempDir, 'media', 'videos', key);
    expect(fs.existsSync(file)).toBe(true);
    deleteProductVideoFile(key);
    expect(fs.existsSync(file)).toBe(false);
    expect(productVideoUrl('../admin')).toBe('');
  });
});
