import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export const MAX_PRODUCT_VIDEO_BYTES = 35 * 1024 * 1024;
export const MAX_PRODUCT_VIDEOS = 3;
export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export class ProductVideoError extends Error {}

export type UploadedVideo = { buffer: Buffer; filename: string; mimetype: string };

function videoRoot(): string {
  return path.join(config.uploadDir, 'media', 'videos');
}

/** Öffentliche URL (über den bestehenden /media/-Static-Pfad). */
export function productVideoUrl(key: string): string {
  if (!/^[a-z0-9-]+\.(mp4|webm)$/.test(key)) return '';
  return `/media/videos/${key}`;
}

export function deleteProductVideoFile(key: string): void {
  if (!/^[a-z0-9-]+\.(mp4|webm)$/.test(key)) return;
  fs.rmSync(path.join(videoRoot(), key), { force: true });
}

/** Speichert ein Video mit MIME-/Magic-Bytes-Prüfung. Kein Transcoding. */
export function storeProductVideo(upload: UploadedVideo): string {
  const extension = ALLOWED_VIDEO_TYPES[upload.mimetype];
  if (!extension) throw new ProductVideoError('Erlaubt sind MP4 (H.264) und WebM (VP9/VP8).');
  if (upload.buffer.length === 0) throw new ProductVideoError('Die Datei ist leer.');
  if (upload.buffer.length > MAX_PRODUCT_VIDEO_BYTES) {
    throw new ProductVideoError('Das Video ist zu groß (maximal 35 MB).');
  }
  const valid =
    (extension === 'mp4' && upload.buffer.subarray(4, 8).toString('ascii') === 'ftyp') ||
    (extension === 'webm' && upload.buffer.subarray(0, 4).toString('hex') === '1a45dfa3');
  if (!valid) throw new ProductVideoError('Die Datei ist kein gültiges Video-Format.');

  fs.mkdirSync(videoRoot(), { recursive: true, mode: 0o750 });
  const key = `video-${crypto.randomBytes(12).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(videoRoot(), key), upload.buffer, { mode: 0o644 });
  return key;
}
