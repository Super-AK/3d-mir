import { describe, expect, it } from 'vitest';
import {
  groupDailyStats,
  isoWeek,
  normalizeVisitorPath,
  shiftDay,
  visitorDay,
  visitorHash,
  type DailyVisitorRow,
} from '../../src/lib/visitor-stats.js';

describe('Besucherstatistik', () => {
  it('zählt Tage in UTC und über Monatsgrenzen hinweg', () => {
    expect(visitorDay(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-19');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('normalisiert Pfade ohne Query und ohne individuelle IDs', () => {
    expect(normalizeVisitorPath('/produkt/42?farbe=rot#anker')).toBe('/produkt/:');
    expect(normalizeVisitorPath('/admin/bestellungen/7/')).toBe('/admin/bestellungen/:/');
    expect(normalizeVisitorPath('')).toBe('/');
    expect(normalizeVisitorPath('/'.repeat(1))).toBe('/');
  });

  it('bildet einen täglich wechselnden, nicht rückführbaren Besucher-Hash', () => {
    const first = visitorHash('192.168.4.12', '2026-11-19');
    expect(visitorHash('192.168.4.99', '2026-11-19')).toBe(first); // gleiches /24
    expect(visitorHash('192.168.5.12', '2026-11-19')).not.toBe(first);
    expect(visitorHash('192.168.4.12', '2026-11-20')).not.toBe(first);
    expect(first).not.toContain('192.168');
    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('berechnet ISO-Kalenderwochen', () => {
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2026-11-19')).toBe(isoWeek('2026-11-22'));
    expect(isoWeek('2026-11-23')).toBe(isoWeek('2026-11-19') + 1);
  });

  it('fasst Tageswerte zu Tagen, Wochen und Monaten zusammen', () => {
    const rows: DailyVisitorRow[] = [
      { day: '2026-11-16', views: 4, visitors: 2 },
      { day: '2026-11-19', views: 6, visitors: 3 },
      { day: '2026-12-02', views: 2, visitors: 1 },
    ];

    const days = groupDailyStats(rows, 'tag');
    expect(days).toHaveLength(3);
    expect(days[0]).toMatchObject({ label: '16.11.', views: 4, visitors: 2, days: 1 });
    expect(days[0]?.percent).toBe(66.7);

    const weeks = groupDailyStats(rows, 'woche');
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ views: 10, visitors: 5, days: 2 });
    expect(weeks[0]?.label).toMatch(/^KW \d+$/);

    const months = groupDailyStats(rows, 'monat');
    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({ views: 10, visitors: 5, days: 2 });
    expect(months[0]?.label).toBe('November 2026');
  });
});
