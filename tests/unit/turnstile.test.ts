import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
process.env.TURNSTILE_SECRET_KEY = 'test-secret';

const { verifyTurnstileToken, turnstileToken, turnstileConfigured } = await import('../../src/lib/turnstile.js');

function stubVerify(body: Record<string, unknown>, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
    }),
  );
}

beforeAll(() => {
  expect(turnstileConfigured()).toBe(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Turnstile', () => {
  it('liest das Token aus Formulardaten', () => {
    expect(turnstileToken({ 'cf-turnstile-response': 'abc' })).toBe('abc');
    expect(turnstileToken({ other: 'abc' })).toBeUndefined();
  });

  it('akzeptiert ein gültiges Token', async () => {
    stubVerify({ success: true });
    expect(await verifyTurnstileToken('gültiges-token')).toBe(true);
  });

  it('lehnt fehlgeschlagene, fehlende und fehlerhafte Tokens ab', async () => {
    stubVerify({ success: false });
    expect(await verifyTurnstileToken('token')).toBe(false);

    expect(await verifyTurnstileToken(undefined)).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await verifyTurnstileToken('token')).toBe(false);
  });
});
