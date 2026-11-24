import { deliverPendingWebhooks } from '../lib/api-webhooks.js';
import { getLogger } from '../lib/logger.js';

/** Zustellt fällige Shop-Webhooks; läuft einmal pro Minute per systemd-Timer. */
async function main(): Promise<void> {
  const logger = getLogger();
  try {
    const result = await deliverPendingWebhooks();
    if (result.sent || result.failed || result.givenUp) {
      logger.info({ result }, 'Webhook-Zustellung abgeschlossen');
    }
  } catch (error) {
    logger.error({ err: error }, 'Webhook-Zustellung fehlgeschlagen');
    process.exitCode = 1;
  }
}

void main();
