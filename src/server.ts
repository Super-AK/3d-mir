import { setTimeout as delay } from 'node:timers/promises';
import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';

const app = await buildApp();
const LISTEN_RETRIES = 5;
const LISTEN_RETRY_DELAY_MS = 1000;

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Beende Anwendung');
  try {
    await app.close();
    closeDb();
    process.exit(0);
  } catch (error) {
    console.error('Fehler beim Beenden:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

/**
 * Wartet bei einem belegten Port kurz und versucht es erneut. Das hilft beim
 * systemd-Neustart, wenn der alte Prozess noch nicht vollständig beendet ist.
 */
async function listen(): Promise<void> {
  for (let attempt = 1; attempt <= LISTEN_RETRIES; attempt += 1) {
    try {
      await app.listen({ host: config.host, port: config.port });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'EADDRINUSE' || attempt === LISTEN_RETRIES) throw error;
      app.log.warn(
        { attempt, port: config.port, retries: LISTEN_RETRIES },
        'Port ist belegt, neuer Versuch',
      );
      await delay(LISTEN_RETRY_DELAY_MS);
    }
  }
}

try {
  await listen();
  app.log.info(
    { host: config.host, port: config.port, env: config.env, root: config.root },
    '3D-MIR gestartet',
  );
} catch (error) {
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);
  // Bewusst console statt Pino: Beim frühen Startfehler ist das Log-Ziel
  // möglicherweise noch nicht bereit, was process.exit() mit einem
  // SonicBoom-Fehler abbrechen würde.
  console.error(`Start fehlgeschlagen: ${message}`);
  if (code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} ist bereits belegt. Prüfen mit: ss -ltnp '( sport = :${config.port} )'`,
    );
  }
  process.exitCode = 1;
  try {
    await app.close();
  } catch (closeError) {
    console.error('Aufräumen nach Startfehler fehlgeschlagen:', closeError);
  }
}
