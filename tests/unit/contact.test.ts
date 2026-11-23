import { describe, expect, it } from 'vitest';
import {
  assessContact,
  contactIpHash,
  contactIpPrefix,
  contactUserAgent,
  createContactToken,
  getSpamBlockResponse,
  headerCountry,
  isTrustedProxyPeer,
  resolveContactCountry,
  verifyContactToken,
} from '../../src/lib/contact-protection.js';
import { countryFromIp, isPrivateAddress } from '../../src/lib/geoip.js';
import type { ContactSettings } from '../../src/lib/contact-settings.js';

const baseSettings: ContactSettings = {
  countryCheck: true,
  allowedCountries: ['DE'],
  mode: 'review',
  unknownCountry: 'review',
  timeCheck: false,
  contentCheck: false,
  spamBanEnabled: true,
  spamBanThreshold: 5,
  spamBanWindowMinutes: 60,
  spamBanHours: 24,
};

const baseInput = {
  settings: baseSettings,
  ipCountry: 'DE',
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
    const result = assessContact({ ...baseInput, ipCountry: 'US', now: Date.now() });
    expect(result.decision).toBe('review');
    expect(result.reasons.join(' ')).toContain('US');
  });

  it('lehnt bei Modus „block“ Anfragen aus gesperrten Ländern direkt ab', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, mode: 'block' },
      ipCountry: 'US',
      now: Date.now(),
    });
    expect(result.decision).toBe('block');
  });

  it('speichert Anfragen ohne ermittelbares Land zur Prüfung', () => {
    const result = assessContact({ ...baseInput, ipCountry: '', now: Date.now() });
    expect(result.decision).toBe('review');
    expect(result.reasons.join(' ')).toContain('nicht ermittelt');
  });

  it('lehnt Anfragen ohne ermittelbares Land ab, wenn so eingestellt', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, unknownCountry: 'block' },
      ipCountry: '',
      now: Date.now(),
    });
    expect(result.decision).toBe('block');
  });

  it('lässt Anfragen ohne ermittelbares Land durch, wenn die Länderprüfung aus ist', () => {
    const result = assessContact({
      ...baseInput,
      settings: { ...baseSettings, countryCheck: false },
      ipCountry: '',
      now: Date.now(),
    });
    expect(result.decision).toBe('ok');
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

describe('Absender-Erkennung', () => {
  it('erzeugt für dieselbe IP dieselbe Prüfsumme, aber nicht die IP selbst', () => {
    const hash = contactIpHash('203.0.113.7');
    expect(hash).toBe(contactIpHash('203.0.113.7'));
    expect(hash).not.toContain('203.0.113.7');
    expect(contactIpHash('203.0.113.8')).not.toBe(hash);
  });

  it('kürzt IPv4- und IPv6-Adressen für die Anzeige', () => {
    expect(contactIpPrefix('203.0.113.7')).toBe('203.0.113.0/24');
    expect(contactIpPrefix('::ffff:203.0.113.7')).toBe('203.0.113.0/24');
    expect(contactIpPrefix('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48');
    expect(contactIpPrefix('2001:db8::1')).toBe('2001:db8:0::/48');
    expect(contactIpPrefix('keine-ip')).toBe('');
  });

  it('bereinigt und begrenzt den User-Agent', () => {
    expect(contactUserAgent('Mozilla/5.0')).toBe('Mozilla/5.0');
    expect(contactUserAgent('a\u0000b')).toBe('ab');
    expect(contactUserAgent('x'.repeat(400))).toHaveLength(300);
    expect(contactUserAgent(undefined)).toBe('');
  });
});

describe('Spam-Sperranzeige', () => {
  it('antwortet gesperrte Absender mit HTTP 404 und „Datei wurde nicht gefunden“', () => {
    const response = getSpamBlockResponse();
    expect(response.status).toBe(404);
    expect(response.body).toContain('404');
    expect(response.body).toContain('nicht gefunden');
    expect(response.body).not.toContain('Zu viele Anfragen');
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

describe('IP-basierte Ländererkennung', () => {
  it('erkennt private und lokale Adressen', () => {
    for (const address of ['127.0.0.1', '::1', '10.1.2.3', '192.168.0.5', '172.20.1.1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it('behandelt öffentliche Adressen nicht als privat', () => {
    for (const address of ['1.1.1.1', '80.187.100.20', '2001:4860:4860::8888']) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });

  it('liest ein Länderkürzel aus Proxy-Headern', () => {
    expect(headerCountry({ 'cf-ipcountry': 'AT' })).toBe('AT');
    expect(headerCountry({ 'x-country-code': 'ch' })).toBe('CH');
    expect(headerCountry({})).toBe('');
  });

  it('akzeptiert Länder-Header nur von konfigurierten Proxies', () => {
    expect(isTrustedProxyPeer('127.0.0.1')).toBe(true);
    expect(isTrustedProxyPeer('::ffff:127.0.0.1')).toBe(true);
    expect(isTrustedProxyPeer('203.0.113.5')).toBe(false);
    expect(isTrustedProxyPeer(undefined)).toBe(false);
  });

  it('ignoriert Länder-Header ohne ausdrückliche Konfiguration', async () => {
    const result = await resolveContactCountry({
      ip: '127.0.0.1',
      headers: { 'cf-ipcountry': 'US' },
      trustedProxy: true,
    });
    expect(result).toEqual({ country: '', source: 'none' });
  });

  it('liefert für ungültige Adressen kein Land', async () => {
    expect(await countryFromIp('keine-ip')).toBe('');
  });
});
