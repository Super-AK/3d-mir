import fs from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { getLogger } from './logger.js';
import {
  getNotificationSettings,
  isSmtpConfigured,
  type SmtpSettings,
} from './notification-settings.js';

export type MailOptions = {
  to?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

type TransportState = {
  transporter: Transporter;
  usingStream: boolean;
  key: string;
};

let state: TransportState | null = null;

function smtpKey(smtp: SmtpSettings): string {
  return JSON.stringify({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
  });
}

function getTransporter(smtp: SmtpSettings): TransportState {
  const key = smtpKey(smtp);
  if (state && state.key === key) return state;

  if (smtp.host) {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    state = { transporter, usingStream: false, key };
  } else {
    // Kein SMTP konfiguriert: Nachricht als .eml ablegen, damit Abläufe testbar bleiben.
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    state = { transporter, usingStream: true, key };
  }
  return state;
}

/** Setzt den gecachten SMTP-Transport zurück, z. B. nach Änderungen im Admin. */
export function resetMailTransporter(): void {
  state = null;
}

/**
 * Versendet eine E-Mail über die im Admin oder per Umgebung konfigurierte SMTP-Verbindung.
 * Ohne SMTP-Konfiguration wird die Nachricht als .eml unter /var/log/3d-mir/mail/ gespeichert.
 */
export async function sendMail(options: MailOptions): Promise<{ delivered: boolean; savedTo?: string }> {
  const logger = getLogger();
  const settings = getNotificationSettings();
  const smtp = settings.smtp;
  const to = options.to ?? smtp.to;
  const { transporter, usingStream } = getTransporter(smtp);
  const message = {
    from: smtp.from,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
  };

  const info = await transporter.sendMail(message);

  if (usingStream) {
    const dir = path.join(config.logDir, 'mail');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = options.subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const file = path.join(dir, `${stamp}-${slug || 'mail'}.eml`);
    const raw = Buffer.isBuffer(info.message) ? info.message : Buffer.from(String(info.message));
    fs.writeFileSync(file, raw, { mode: 0o640 });
    logger.warn({ file, to, subject: options.subject }, 'SMTP nicht konfiguriert – E-Mail als Datei gespeichert');
    return { delivered: false, savedTo: file };
  }

  logger.info({ to, subject: options.subject, messageId: info.messageId }, 'E-Mail versendet');
  return { delivered: true };
}

/** Prüft, ob eine echte SMTP-Verbindung konfiguriert ist. */
export function isMailConfigured(): boolean {
  return isSmtpConfigured();
}
