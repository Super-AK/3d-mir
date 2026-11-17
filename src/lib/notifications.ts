import { getLogger } from './logger.js';
import { sendMail } from './mailer.js';
import {
  getNotificationSettings,
  notificationChannelLabel,
  type NotificationEvent,
} from './notification-settings.js';
import { sendTelegramMessage } from './telegram.js';

export type AdminNotification = {
  /** Ereignis, das im Admin einzeln ein- oder ausgeschaltet werden kann. */
  event: NotificationEvent;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Optionaler, kürzerer Text für Telegram; sonst Betreff + Text. */
  telegramText?: string;
};

/**
 * Benachrichtigt den Betreiber über den im Admin gewählten Kanal.
 *
 * Kunden-E-Mails laufen weiterhin direkt über `sendMail` und sind von der
 * Kanalwahl nicht betroffen.
 */
export async function notifyAdmin(notification: AdminNotification): Promise<void> {
  const settings = getNotificationSettings();
  if (settings.events[notification.event] === false) {
    getLogger().debug(
      { event: notification.event },
      'Admin-Benachrichtigung im Admin deaktiviert',
    );
    return;
  }
  const channel = settings.channel;
  const errors: string[] = [];

  if (channel === 'mail' || channel === 'both') {
    try {
      await sendMail({
        subject: notification.subject,
        text: notification.text,
        html: notification.html,
        replyTo: notification.replyTo,
      });
    } catch (error) {
      errors.push(`E-Mail: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`);
    }
  }

  if (channel === 'telegram' || channel === 'both') {
    try {
      await sendTelegramMessage(notification.telegramText ?? `${notification.subject}\n\n${notification.text}`);
    } catch (error) {
      errors.push(`Telegram: ${error instanceof Error ? error.message : 'unbekannter Fehler'}`);
    }
  }

  if (errors.length > 0) {
    getLogger().warn(
      { channel: notificationChannelLabel(channel), errors },
      'Admin-Benachrichtigung konnte nicht vollständig versendet werden',
    );
  }
}
