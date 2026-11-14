import crypto from 'node:crypto';

/**
 * TOTP nach RFC 6238 (SHA-1, 6 Stellen, 30 Sekunden).
 *
 * Die Secrets werden als Base32 gespeichert, wie es Authenticator-Apps
 * erwarten. Es werden keine externen Dienste benötigt.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    (((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff)) %
    10 ** DIGITS;
  return String(code).padStart(DIGITS, '0');
}

/** Prüft einen 6-stelligen Code; ein Zeitfenster von ±1 Schritt wird toleriert. */
export function verifyTotp(secret: string, token: string, now = Date.now()): boolean {
  const normalized = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized) || !secret) return false;
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (let offset = -1; offset <= 1; offset += 1) {
    const candidate = counter + offset;
    if (candidate < 0) continue;
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, candidate)), Buffer.from(normalized))) {
      return true;
    }
  }
  return false;
}

/** otpauth-URI für Authenticator-Apps und QR-Codes. */
export function totpUri(secret: string, account: string, issuer = '3D-MIR Admin'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
