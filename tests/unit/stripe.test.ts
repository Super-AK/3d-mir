import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config.js';
import { getStripeDiagnostics, stripeErrorDetail } from '../../src/lib/payments/stripe.js';

const originalStripe = { ...config.stripe };
const originalBaseUrl = config.payment.baseUrl;

afterEach(() => {
  Object.assign(config.stripe, originalStripe);
  config.payment.baseUrl = originalBaseUrl;
});

describe('Stripe-Diagnose', () => {
  it('erkennt einen Live-Restricted-Key ohne den Schlüssel preiszugeben', () => {
    config.stripe.secretKey = 'rk_live_geheimnis123';
    config.stripe.webhookSecret = 'whsec_1234567890';
    config.stripe.mode = 'live';
    config.payment.baseUrl = 'https://www.3d-mir.de';

    const diagnostics = getStripeDiagnostics();
    expect(diagnostics.configured).toBe(true);
    expect(diagnostics.keyKind).toBe('restricted-live');
    expect(diagnostics.keyLabel).toBe('rk_live…');
    expect(diagnostics.keyMode).toBe('live');
    expect(diagnostics.restricted).toBe(true);
    expect(diagnostics.modeMatches).toBe(true);
    expect(diagnostics.webhookLooksValid).toBe(true);
    expect(diagnostics.paymentBaseUrl).toBe('https://www.3d-mir.de');
    expect(diagnostics.issues).toEqual([]);
    expect(JSON.stringify(diagnostics)).not.toContain('rk_live_geheimnis123');
  });

  it('meldet einen Modus-Konflikt zwischen Test-Schlüssel und Live-Modus', () => {
    config.stripe.secretKey = 'sk_test_123';
    config.stripe.webhookSecret = 'whsec_1234567890';
    config.stripe.mode = 'live';

    const diagnostics = getStripeDiagnostics();
    expect(diagnostics.keyKind).toBe('secret-test');
    expect(diagnostics.modeMatches).toBe(false);
    expect(diagnostics.issues.join(' ')).toContain('STRIPE_MODE=live');
    expect(diagnostics.issues.join(' ')).toContain('sk_test…');
  });

  it('meldet fehlende Geheimnisse', () => {
    config.stripe.secretKey = '';
    config.stripe.webhookSecret = '';
    config.stripe.mode = 'test';

    const diagnostics = getStripeDiagnostics();
    expect(diagnostics.configured).toBe(false);
    expect(diagnostics.issues.join(' ')).toContain('STRIPE_SECRET_KEY');
    expect(diagnostics.issues.join(' ')).toContain('STRIPE_WEBHOOK_SECRET');
  });

  it('begrenzt Stripe-Fehler auf die Nachricht', () => {
    const error = new Error('Permission denied\n' + 'x'.repeat(500));
    expect(stripeErrorDetail(error)).toHaveLength(300);
    expect(stripeErrorDetail(error)).toContain('Permission denied');
    expect(stripeErrorDetail(error)).not.toContain('\n');
  });
});
