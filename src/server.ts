import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';

const app = await buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Beende Anwendung');
  try {
    await app.close();
    closeDb();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Fehler beim Beenden');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    { host: config.host, port: config.port, env: config.env, root: config.root },
    '3D-MIR gestartet',
  );
} catch (error) {
  app.log.error({ err: error }, 'Start fehlgeschlagen');
  process.exit(1);
}
