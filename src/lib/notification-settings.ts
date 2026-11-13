import { config } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Einstellungen für Admin-Benachrichtigungen.
 *
 * Kunden-E-Mails (Bestellbestätigung, Statusmeldungen) gehen immer per E-Mail
 * heraus. Die Kanalwahl gilt nur für Benachrichtigungen an den Betreiber.
 *
 * Die Werte werden im Admin unter „Benachrichtigungen“ gepflegt und in der
 * Tabelle `settings` gespeichert. Solange dort nichts eingetragen ist, gelten
 * die Umgebungsvariablen aus `/etc/3d-mir/3d-mir.env`.
 */
export type NotificationChannel = 'mail' | 'telegram' | 'both';

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
};

export type TelegramSettings = {
  botToken: string;
  chatId: string;
};

export type NotificationSettings = {
  channel: NotificationChannel;
  smtp: SmtpSettings;
  telegram: TelegramSettings;
};

export type NotificationOverrides = {
  channel?: NotificationChannel;
  smtp?: Partial<SmtpSettings>;
  telegram?: Partial<TelegramSettings>;
};

const SETTINGS_KEY = 'notifications';

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function secret(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 'on') return true;
  if (value === 'false' || value === '0' || value === 'off') return false;
  return fallback;
}

function channel(value: unknown): NotificationChannel | undefined {
  return value === 'mail' || value === 'telegram' || value === 'both' ? value : undefined;
}

function envDefaults(): NotificationSettings {
  return {
    channel: config.notifications.channel,
    smtp: {
      host: config.mail.host ?? '',
      port: config.mail.port,
      secure: config.mail.secure,
      user: config.mail.user ?? '',
      pass: config.mail.pass ?? '',
      from: config.mail.from,
      to: config.mail.to,
    },
    telegram: {
      botToken: config.notifications.telegramBotToken,
      chatId: config.notifications.telegramChatId,
    },
  };
}

/** Liest die im Admin gespeicherten Overrides (ohne Umgebungs-Fallbacks). */
export function getNotificationOverrides(): NotificationOverrides {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const raw = parsed as Record<string, unknown>;
  const smtp = raw.smtp && typeof raw.smtp === 'object' ? (raw.smtp as Record<string, unknown>) : {};
  const telegram =
    raw.telegram && typeof raw.telegram === 'object' ? (raw.telegram as Record<string, unknown>) : {};

  const overrides: NotificationOverrides = {};
  const selectedChannel = channel(raw.channel);
  if (selectedChannel) overrides.channel = selectedChannel;

  const port = Number(smtp.port);
  const smtpOverride: Partial<SmtpSettings> = {};
  if (typeof smtp.host === 'string') smtpOverride.host = text(smtp.host, 200);
  if (Number.isFinite(port) && port > 0 && port <= 65535) smtpOverride.port = Math.trunc(port);
  if (smtp.secure !== undefined) smtpOverride.secure = bool(smtp.secure, true);
  if (typeof smtp.user === 'string') smtpOverride.user = text(smtp.user, 200);
  if (typeof smtp.pass === 'string') smtpOverride.pass = secret(smtp.pass, 500);
  if (typeof smtp.from === 'string') smtpOverride.from = text(smtp.from, 300);
  if (typeof smtp.to === 'string') smtpOverride.to = text(smtp.to, 300);
  if (Object.keys(smtpOverride).length > 0) overrides.smtp = smtpOverride;

  const telegramOverride: Partial<TelegramSettings> = {};
  if (typeof telegram.botToken === 'string') telegramOverride.botToken = secret(telegram.botToken, 300);
  if (typeof telegram.chatId === 'string') telegramOverride.chatId = text(telegram.chatId, 100);
  if (Object.keys(telegramOverride).length > 0) overrides.telegram = telegramOverride;

  return overrides;
}

/** Liefert die effektiven Einstellungen (Admin-Overrides über Umgebungsvariablen). */
export function getNotificationSettings(): NotificationSettings {
  const env = envDefaults();
  const overrides = getNotificationOverrides();
  const smtp = overrides.smtp ?? {};
  const telegram = overrides.telegram ?? {};

  return {
    channel: overrides.channel ?? env.channel,
    smtp: {
      host: text(smtp.host, 200) || env.smtp.host,
      port: Number.isFinite(Number(smtp.port)) ? Number(smtp.port) : env.smtp.port,
      secure: smtp.secure === undefined ? env.smtp.secure : bool(smtp.secure, env.smtp.secure),
      user: text(smtp.user, 200) || env.smtp.user,
      pass: secret(smtp.pass, 500) || env.smtp.pass,
      from: text(smtp.from, 300) || env.smtp.from,
      to: text(smtp.to, 300) || env.smtp.to,
    },
    telegram: {
      botToken: secret(telegram.botToken, 300) || env.telegram.botToken,
      chatId: text(telegram.chatId, 100) || env.telegram.chatId,
    },
  };
}

/** Speichert die Admin-Einstellungen; leere Geheimnisse bleiben leer und fallen auf die Umgebung zurück. */
export function saveNotificationSettings(settings: NotificationSettings): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(SETTINGS_KEY, JSON.stringify(settings));
}

export function isSmtpConfigured(settings: NotificationSettings = getNotificationSettings()): boolean {
  return settings.smtp.host !== '';
}

export function isTelegramConfigured(settings: NotificationSettings = getNotificationSettings()): boolean {
  return settings.telegram.botToken !== '' && settings.telegram.chatId !== '';
}

export function notificationChannelLabel(value: NotificationChannel): string {
  if (value === 'telegram') return 'Nur Telegram';
  if (value === 'both') return 'E-Mail und Telegram';
  return 'Nur E-Mail';
}
