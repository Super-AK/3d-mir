import { getLogger } from './logger.js';
import { getNotificationSettings, type TelegramSettings } from './notification-settings.js';

/**
 * Sendet eine Nachricht über die Telegram Bot API.
 *
 * Der Bot-Token wird nicht protokolliert. Nachrichten werden als Klartext
 * gesendet, damit keine HTML-/Markdown-Escaping-Fehler entstehen.
 */
export async function sendTelegramMessage(
  text: string,
  settings?: TelegramSettings,
): Promise<{ delivered: boolean }> {
  const telegram = settings ?? getNotificationSettings().telegram;
  if (!telegram.botToken || !telegram.chatId) {
    throw new Error('Telegram ist nicht konfiguriert (Bot-Token und Chat-ID fehlen).');
  }
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(telegram.botToken)) {
    throw new Error('Der Telegram-Bot-Token hat ein ungültiges Format.');
  }

  const body = JSON.stringify({
    chat_id: telegram.chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  });

  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    throw new Error(
      `Telegram ist nicht erreichbar: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`,
    );
  }

  let result: unknown = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  const ok =
    response.ok &&
    typeof result === 'object' &&
    result !== null &&
    (result as { ok?: unknown }).ok === true;
  if (!ok) {
    const description =
      typeof result === 'object' && result !== null
        ? String((result as { description?: unknown }).description ?? '')
        : '';
    getLogger().warn({ status: response.status, description }, 'Telegram-Nachricht abgelehnt');
    throw new Error(description || `Telegram-API-Fehler (${response.status})`);
  }

  return { delivered: true };
}
