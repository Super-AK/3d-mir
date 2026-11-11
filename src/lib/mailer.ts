import fs from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { getLogger } from './logger.js';

export type MailOptions = {
  to?: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

let transporter: Transporter | null = null;
let usingStream = false;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (config.mail.host) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
    usingStream = false;
  } else {
    // Kein SMTP konfiguriert: Nachricht als .eml ablegen, damit Abläufe testbar bleiben.
    transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    usingStream = true;
  }
  return transporter;
}

/**
 * Versendet eine E-Mail. Ohne SMTP-Konfiguration wird die Nachricht als .eml
 * unter /var/log/3d-mir/mail/ gespeichert (kein Versand nach außen).
 */
export async function sendMail(options: MailOptions): Promise<{ delivered: boolean; savedTo?: string }> {
  const logger = getLogger();
  const to = options.to ?? config.mail.to;
  const message = {
    from: config.mail.from,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
  };

  const info = await getTransporter().sendMail(message);

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

/** Prüft, ob ein echtes SMTP-Postfach konfiguriert ist. */
export function isMailConfigured(): boolean {
  return Boolean(config.mail.host);
}
