import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Liest den Zustand des Uptime-Checks für die Anzeige im Admin.
 * Die Datei wird von `src/scripts/uptime-check.ts` geschrieben.
 */
export type MonitorStatus = {
  available: boolean;
  down: boolean;
  since: string;
  lastAlert: string;
  lastCheck: string;
  lastOk: string;
  detail: string;
};

const EMPTY: MonitorStatus = {
  available: false,
  down: false,
  since: '',
  lastAlert: '',
  lastCheck: '',
  lastOk: '',
  detail: '',
};

export function getMonitorStatus(): MonitorStatus {
  const file = path.join(config.dataDir, 'monitor-state.json');
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    const raw = parsed as Record<string, unknown>;
    const text = (value: unknown): string => (typeof value === 'string' ? value : '');
    return {
      available: true,
      down: raw.down === true,
      since: text(raw.since),
      lastAlert: text(raw.lastAlert),
      lastCheck: text(raw.lastCheck),
      lastOk: text(raw.lastOk),
      detail: text(raw.detail),
    };
  } catch {
    return EMPTY;
  }
}
