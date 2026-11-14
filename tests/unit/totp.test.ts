import { describe, expect, it } from 'vitest';
import { generateTotpSecret, totpUri, verifyTotp } from '../../src/lib/totp.js';

// RFC-6238-Testvektor (SHA-1, 20-Byte-Secret, Zeit 59 s).
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP', () => {
  it('erkennt den RFC-Testvektor als 6-stelligen Code', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59_000)).toBe(true);
  });

  it('toleriert ein Zeitfenster von ±30 Sekunden', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 59_000 - 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '287082', 59_000 + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '287082', 59_000 + 120_000)).toBe(false);
  });

  it('lehnt falsche und unvollständige Codes ab', () => {
    expect(verifyTotp(RFC_SECRET, '000000', 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '28708', 59_000)).toBe(false);
    expect(verifyTotp('', '287082', 59_000)).toBe(false);
  });

  it('erzeugt 32-stellige Base32-Secrets und eine otpauth-URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const uri = totpUri(secret, 'admin@example.de');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=3D-MIR+Admin');
  });
});
