import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { notifyAdmin } from '../lib/notifications.js';

/**
 * Uptime-Check für den eigenen Server.
 *
 * Prüft den Health-Endpunkt der Anwendung und benachrichtigt den Betreiber
 * über den im Admin gewählten Kanal, wenn die Anwendung nicht erreichbar ist
 * oder wieder läuft. Der Zustand wird in einer kleinen Datei gespeichert,
 * damit nicht bei jedem Lauf eine neue Nachricht entsteht.
 *
 * Aufruf (aus dem Projektverzeichnis):
 *   npm run monitor:check
 */

const STATE_FILE = path.join(config.dataDir, 'monitor-state.json');
const ALERT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

type MonitorState = {
  down: boolean;
  since?: string;
  lastAlert?: string;
};

function readState(): MonitorState {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as MonitorState) : { down: false };
  } catch {
    return { down: false };
  }
}

function writeState(state: MonitorState): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true, mode: 0o750 });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o640 });
  } catch (error) {
    console.error('Monitor-Zustand konnte nicht gespeichert werden:', error);
  }
}

async function checkHealth(url: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const body = (await response.json().catch(() => ({}))) as { status?: string };
    return body.status === 'ok'
      ? { ok: true, detail: 'Status ok' }
      : { ok: false, detail: 'Health-Antwort ohne status=ok' };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'unbekannter Fehler' };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const port = process.env.PORT || '3000';
  const url = `http://127.0.0.1:${port}/api/health`;
  const state = readState();
  const result = await checkHealth(url);
  const now = new Date();
  const stamp = now.toISOString();

  if (result.ok) {
    if (state.down) {
      await notifyAdmin({
        subject: '[Monitoring] 3D-MIR ist wieder erreichbar',
        text: [
          'Die Website ist wieder erreichbar.',
          '',
          `Adresse: ${url}`,
          `Ausfall seit: ${state.since ?? 'unbekannt'}`,
          `Wieder erreichbar: ${stamp}`,
          '',
          result.detail,
        ].join('\n'),
      });
      console.log('Wieder erreichbar; Benachrichtigung versendet.');
    } else {
      console.log('Health-Check ok.');
    }
    writeState({ down: false });
    return;
  }

  const lastAlert = state.lastAlert ? Date.parse(state.lastAlert) : 0;
  const shouldAlert = !state.down || !Number.isFinite(lastAlert) || now.getTime() - lastAlert >= ALERT_INTERVAL_MS;
  if (shouldAlert) {
    await notifyAdmin({
      subject: '[Monitoring] 3D-MIR ist nicht erreichbar',
      text: [
        'Der Health-Check der Website ist fehlgeschlagen.',
        '',
        `Adresse: ${url}`,
        `Zeitpunkt: ${stamp}`,
        `Fehler: ${result.detail}`,
        '',
        'Bitte Dienst und Server prüfen: systemctl status 3d-mir.service',
      ].join('\n'),
    });
    console.log(`Nicht erreichbar (${result.detail}); Benachrichtigung versendet.`);
  } else {
    console.log(`Weiterhin nicht erreichbar (${result.detail}); keine erneute Benachrichtigung.`);
  }

  writeState({
    down: true,
    since: state.down && state.since ? state.since : stamp,
    lastAlert: shouldAlert ? stamp : state.lastAlert,
  });
}

main().catch((error) => {
  console.error('Uptime-Check fehlgeschlagen:', error);
  process.exitCode = 1;
});
