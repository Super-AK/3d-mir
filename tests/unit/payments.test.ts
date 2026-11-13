import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyStripeWebhook } from '../../src/lib/payments/stripe.js';
import { paymentStatusLabel, paymentStatusTone } from '../../src/lib/payments/index.js';

const secret = 'whsec_test_1234567890';

function signedPayload(payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Stripe-Webhook', () => {
  it('akzeptiert eine korrekt signierte Nachricht', () => {
    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', metadata: { order_id: '1' } } },
    });
    const event = verifyStripeWebhook(Buffer.from(payload), signedPayload(payload), secret);
    expect(event.id).toBe('evt_test_1');
    expect(event.type).toBe('checkout.session.completed');
  });

  it('lehnt eine falsche Signatur ab', () => {
    const payload = JSON.stringify({ id: 'evt_test_2', type: 'checkout.session.completed', data: { object: {} } });
    expect(() => verifyStripeWebhook(Buffer.from(payload), 't=123,v1=deadbeef', secret)).toThrow();
  });

  it('lehnt eine veraltete Signatur ab', () => {
    const payload = JSON.stringify({ id: 'evt_test_3', type: 'checkout.session.completed', data: { object: {} } });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    expect(() => verifyStripeWebhook(Buffer.from(payload), signedPayload(payload, oldTimestamp), secret)).toThrow();
  });

  it('verändert den Body nicht und erkennt Manipulation', () => {
    const payload = JSON.stringify({ id: 'evt_test_4', type: 'checkout.session.completed', data: { object: {} } });
    const signature = signedPayload(payload);
    const tampered = payload.replace('evt_test_4', 'evt_test_5');
    expect(() => verifyStripeWebhook(Buffer.from(tampered), signature, secret)).toThrow();
  });
});

describe('Zahlungsstatus', () => {
  it('liefert deutsche Bezeichnungen und passende Badge-Farben', () => {
    expect(paymentStatusLabel('bezahlt')).toBe('Bezahlt');
    expect(paymentStatusLabel('fehlgeschlagen')).toBe('Zahlung fehlgeschlagen');
    expect(paymentStatusTone('bezahlt')).toBe('success');
    expect(paymentStatusTone('fehlgeschlagen')).toBe('danger');
    expect(paymentStatusTone('offen')).toBe('warning');
  });
});
