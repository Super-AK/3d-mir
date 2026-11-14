import { describe, expect, it } from 'vitest';
import {
  assessContact,
  createContactToken,
  verifyContactToken,
} from '../../src/lib/contact-protection.js';
import type { ContactSettings } from '../../src/lib/contact-settings.js';

const baseSettings: ContactSettings = {
  countryCheck: true,
  allowedCountries: ['DE'],
  mode: 'review',
  timeCheck: false,
  contentCheck: false,
};

const baseInput = {
  settings: baseSettings,
  formCountry: 'DE',
  token: '',
  name: 'Erika Beispiel',
  email: 'erika@example.de',
  subject: 'Allgemeine Anfrage',
  message: 'Ich habe eine Frage zu einem Bauteil aus PETG.',
};

describe('Kontakt-Spam-Schutz', () => {
  it('akzeptiert eine Anfrage aus einem erlaubten Land', () => {
    const result = assessContact({ ...baseInput, now: Date.now() });
    expect(result.decision).toBe('ok');
    expect(result.country).toBe('DE');
    expect(result.reasons).toEqual([]);
  });

  it('stuft eine Anfrage aus einem nicht freigegebenen Land zur Prüfung ein', () => {
    const result = assessContact({ ...baseInput, formCountry: 'US', now: Date.now() });
    expect(result.decision).toBe('review');
    expect(result.reasons.join(' ')).toContain('US');
  });

  it('lehnt bei Modus „block“ Anfragen aus gesperrten Ländern direkt ab', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, mode: 'block' },
      formCountry: 'US',
      now: Date.now(),
    });
    expect(result.decision).toBe('block');
  });

  it('prüft das Land aus einem Proxy-Header, wenn vorhanden', () => {
    const result = assessContact({
      ...baseInput,
      formCountry: 'DE',
      headerCountry: 'FR',
      now: Date.now(),
    });
    expect(result.decision).toBe('review');
    expect(result.country).toBe('FR');
  });

  it('erkennt typische Spam-Begriffe', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, contentCheck: true },
      message: 'Beste SEO Service für Backlinks und Guest Post, jetzt buchen.',
      now: Date.now(),
    });
    expect(result.decision).toBe('review');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('erkennt überwiegende Großschreibung', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, contentCheck: true },
      message: 'DIES IST EINE SEHR LAUTE NACHRICHT MIT VIELEN GROSSBUCHSTABEN',
      now: Date.now(),
    });
    expect(result.decision).toBe('review');
  });
});

describe('Kontakt-Formular-Token', () => {
  it('akzeptiert ein ausreichend altes, korrekt signiertes Token', () => {
    const now = Date.now();
    const token = createContactToken(now - 5_000);
    expect(verifyContactToken(token, now)).toEqual({ ok: true });
  });

  it('lehnt ein zu junges Token ab', () => {
    const now = Date.now();
    const token = createContactToken(now - 1_000);
    const result = verifyContactToken(token, now);
    expect(result.ok).toBe(false);
  });

  it('lehnt ein manipuliertes Token ab', () => {
    const now = Date.now();
    const token = createContactToken(now - 5_000);
    const result = verifyContactToken(`${token}x`, now);
    expect(result.ok).toBe(false);
  });

  it('lehnt ein abgelaufenes Token ab', () => {
    const now = Date.now();
    const token = createContactToken(now - 25 * 60 * 60 * 1_000);
    const result = verifyContactToken(token, now);
    expect(result.ok).toBe(false);
  });

  it('lehnt ein fehlendes Token ab', () => {
    expect(verifyContactToken(undefined).ok).toBe(false);
  });
});
