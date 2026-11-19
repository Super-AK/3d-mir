import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { normalizeCountry, countryName } from './countries.js';
import { contactIpPrefix } from './contact-protection.js';
import { isPrivateAddress } from './geoip.js';

/**
 * Serverseitige Besucherstatistik ohne Cookies und ohne Speicherung von
 * IP-Adressen. Für die Zählung eindeutiger Besucher wird ein HMAC aus der
 * gekürzten IP (IPv4 /24, IPv6 /48) und dem UTC-Tag gebildet. Der Hash wechselt
 * deshalb täglich und lässt sich ohne das Server-Secret nicht rückführen.
 *
 * Gespeichert werden nur Zähler pro Tag, Land und Besucher-Hash sowie Zähler
 * pro Tag und aufgerufenem Pfad. Die Daten werden nach 12 Monaten gelöscht.
 */

export type VisitorGroup = 'tag' | 'woche' | 'monat';

export const visitorGroups: { id: VisitorGroup; label: string }[] = [
  { id: 'tag', label: 'Täglich' },
  { id: 'woche', label: 'Wöchentlich' },
  { id: 'monat', label: 'Monatlich' },
];

export const visitorPeriods = [
  { days: 7, label: 'Letzte 7 Tage' },
  { days: 30, label: 'Letzte 30 Tage' },
  { days: 90, label: 'Letzte 90 Tage' },
  { days: 365, label: 'Letzte 12 Monate' },
];

export type DailyVisitorRow = { day: string; views: number; visitors: number };
export type CountryVisitorRow = { country: string; views: number; visitors: number };
export type PageVisitorRow = { path: string; views: number };

export type VisitorBucket = {
  label: string;
  views: number;
  visitors: number;
  days: number;
  percent: number;
};

export type VisitorCountry = {
  code: string;
  name: string;
  views: number;
  visitors: number;
  percent: number;
};

export type VisitorPage = { path: string; views: number; percent: number };

export type VisitorReport = {
  from: string;
  to: string;
  days: number;
  group: VisitorGroup;
  views: number;
  visitors: number;
  countryCount: number;
  avgViews: number;
  avgVisitors: number;
  buckets: VisitorBucket[];
  countries: VisitorCountry[];
  pages: VisitorPage[];
  hasData: boolean;
};

export type VisitorDashboard = {
  todayViews: number;
  todayVisitors: number;
  weekViews: number;
  weekVisitors: number;
  series: { label: string; views: number; visitors: number; percent: number }[];
  countries: VisitorCountry[];
  hasData: boolean;
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dayFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** UTC-Tag im Format YYYY-MM-DD. */
export function visitorDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Verschiebt einen Tag um die angegebene Anzahl von Tagen. */
export function shiftDay(day: string, offset: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return visitorDay(date);
}

function parseDay(day: string): Date {
  return new Date(`${DAY_PATTERN.test(day) ? day : visitorDay()}T00:00:00Z`);
}

/** Pfad ohne Query/String und ohne individuelle numerische Segmente. */
export function normalizeVisitorPath(raw: string): string {
  const withoutQuery = String(raw ?? '').split(/[?#]/, 1)[0] || '/';
  const normalized = withoutQuery
    .split('/')
    .map((segment) => (/^\d+$/.test(segment) ? ':' : segment))
    .join('/')
    .slice(0, 200);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

/** Täglich wechselnder Besucher-Hash; die IP selbst wird nie gespeichert. */
export function visitorHash(ip: string, day: string): string {
  const prefix = contactIpPrefix(ip) || (isPrivateAddress(ip) ? 'lokal' : 'unbekannt');
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(`visitor:${day}:${prefix}`)
    .digest('base64url')
    .slice(0, 32);
}

/** ISO-Kalenderwoche eines Datums. */
export function isoWeek(day: string): number {
  const date = parseDay(day);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function bucketKey(day: string, group: VisitorGroup): string {
  if (group === 'monat') return day.slice(0, 7);
  if (group === 'woche') {
    const date = parseDay(day);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return visitorDay(date);
  }
  return day;
}

function bucketLabel(key: string, group: VisitorGroup): string {
  if (group === 'monat') return monthFormatter.format(parseDay(`${key}-01`));
  if (group === 'woche') return `KW ${isoWeek(key)}`;
  return dayFormatter.format(parseDay(key));
}

/** Fasst Tageswerte zu Tagen, Kalenderwochen oder Monaten zusammen. */
export function groupDailyStats(rows: DailyVisitorRow[], group: VisitorGroup): VisitorBucket[] {
  const buckets = new Map<string, VisitorBucket>();
  for (const row of rows) {
    const key = bucketKey(row.day, group);
    const bucket = buckets.get(key) ?? {
      label: bucketLabel(key, group),
      views: 0,
      visitors: 0,
      days: 0,
      percent: 0,
    };
    bucket.views += row.views;
    bucket.visitors += row.visitors;
    bucket.days += 1;
    buckets.set(key, bucket);
  }
  const result = [...buckets.values()];
  const maximum = Math.max(1, ...result.map((bucket) => bucket.views));
  for (const bucket of result) bucket.percent = Math.round((bucket.views / maximum) * 1000) / 10;
  return result;
}

/** Zählt einen Aufruf. Fehler dürfen die Antwort nie beeinflussen. */
export function recordVisit(input: {
  ip: string;
  country: string;
  path: string;
  day?: string;
  now?: string;
}): void {
  const day = input.day ?? visitorDay();
  const hash = visitorHash(input.ip, day);
  const country = normalizeCountry(input.country);
  const page = normalizeVisitorPath(input.path);
  const seen = input.now ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO visitor_stats (day, country, visitor_hash, views, last_seen)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(day, country, visitor_hash)
         DO UPDATE SET views = views + 1, last_seen = excluded.last_seen`,
    ).run(day, country, hash, seen);
    db.prepare(
      `INSERT INTO visitor_pages (day, path, views)
         VALUES (?, ?, 1)
         ON CONFLICT(day, path) DO UPDATE SET views = views + 1`,
    ).run(day, page);
  })();
}

function dailyRows(from: string, to: string): DailyVisitorRow[] {
  return getDb()
    .prepare(
      `SELECT day, SUM(views) AS views, COUNT(*) AS visitors
         FROM visitor_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY day
        ORDER BY day`,
    )
    .all(from, to) as DailyVisitorRow[];
}

function countryRows(from: string, to: string): VisitorCountry[] {
  const rows = getDb()
    .prepare(
      `SELECT country, SUM(views) AS views, COUNT(*) AS visitors
         FROM visitor_stats
        WHERE day BETWEEN ? AND ?
        GROUP BY country
        ORDER BY views DESC, country`,
    )
    .all(from, to) as CountryVisitorRow[];
  const maximum = Math.max(1, ...rows.map((row) => row.views));
  return rows.map((row) => ({
    code: row.country,
    name: row.country ? countryName(row.country) : 'Unbekannt',
    views: row.views,
    visitors: row.visitors,
    percent: Math.round((row.views / maximum) * 1000) / 10,
  }));
}

function pageRows(from: string, to: string, limit: number): VisitorPage[] {
  const rows = getDb()
    .prepare(
      `SELECT path, SUM(views) AS views
         FROM visitor_pages
        WHERE day BETWEEN ? AND ?
        GROUP BY path
        ORDER BY views DESC, path
        LIMIT ?`,
    )
    .all(from, to, limit) as PageVisitorRow[];
  const maximum = Math.max(1, ...rows.map((row) => row.views));
  return rows.map((row) => ({
    path: row.path,
    views: row.views,
    percent: Math.round((row.views / maximum) * 1000) / 10,
  }));
}

/** Vollständige Auswertung für die Admin-Seite. */
export function visitorReport(days: number, group: VisitorGroup, today = visitorDay()): VisitorReport {
  const to = today;
  const from = shiftDay(to, -(days - 1));
  const daily = dailyRows(from, to);
  const buckets = groupDailyStats(daily, group);
  const countries = countryRows(from, to);
  const views = daily.reduce((sum, row) => sum + row.views, 0);
  const visitors = daily.reduce((sum, row) => sum + row.visitors, 0);

  return {
    from,
    to,
    days,
    group,
    views,
    visitors,
    countryCount: countries.length,
    avgViews: Math.round((views / days) * 10) / 10,
    avgVisitors: Math.round((visitors / days) * 10) / 10,
    buckets,
    countries,
    pages: pageRows(from, to, 10),
    hasData: daily.length > 0,
  };
}

/** Kompakte Zusammenfassung für das Dashboard (heute und letzte 7 Tage). */
export function visitorDashboard(today = visitorDay()): VisitorDashboard {
  const from = shiftDay(today, -6);
  const daily = dailyRows(from, today);
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const series = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, index - 6);
    const row = byDay.get(day);
    return {
      label: dayFormatter.format(parseDay(day)),
      views: row?.views ?? 0,
      visitors: row?.visitors ?? 0,
    };
  });
  const maximum = Math.max(1, ...series.map((row) => row.views));
  const todayRow = byDay.get(today);

  return {
    todayViews: todayRow?.views ?? 0,
    todayVisitors: todayRow?.visitors ?? 0,
    weekViews: series.reduce((sum, row) => sum + row.views, 0),
    weekVisitors: series.reduce((sum, row) => sum + row.visitors, 0),
    series: series.map((row) => ({
      ...row,
      percent: Math.round((row.views / maximum) * 1000) / 10,
    })),
    countries: countryRows(from, today).slice(0, 4),
    hasData: daily.length > 0,
  };
}

/** Löscht Statistikdaten älter als die angegebene Anzahl von Monaten. */
export function pruneVisitorStats(months = 12, dryRun = false): number {
  const cutoff = `-${Math.max(1, months)} months`;
  const db = getDb();
  const statsTable = 'visitor_stats';
  const pagesTable = 'visitor_pages';
  const count =
    (db.prepare(`SELECT COUNT(*) AS count FROM ${statsTable} WHERE day < date('now', ?)`).get(cutoff) as {
      count: number;
    }).count +
    (db.prepare(`SELECT COUNT(*) AS count FROM ${pagesTable} WHERE day < date('now', ?)`).get(cutoff) as {
      count: number;
    }).count;
  if (!dryRun) {
    db.transaction(() => {
      db.prepare(`DELETE FROM ${statsTable} WHERE day < date('now', ?)`).run(cutoff);
      db.prepare(`DELETE FROM ${pagesTable} WHERE day < date('now', ?)`).run(cutoff);
    })();
  }
  return count;
}

/** Löscht alle Besucherstatistik-Daten (z. B. beim Zurücksetzen der Testdaten). */
export function clearVisitorStats(): number {
  const db = getDb();
  return db.transaction(() => {
    const stats = (db.prepare('DELETE FROM visitor_stats').run() as { changes: number }).changes;
    const pages = (db.prepare('DELETE FROM visitor_pages').run() as { changes: number }).changes;
    return stats + pages;
  })();
}
