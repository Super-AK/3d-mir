import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * Sendet eine Test-E-Mail mit der aktuell aktiven Konfiguration.
 *
 * Aufruf:
 *   npm run mail:test
 *   sudo -u mir3d env DATA_DIR=… DB_PATH=… npm run mail:test
 */
const envFile = process.env.ENV_FILE ?? '/etc/3d-mir/3d-mir.env';
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
dotenv.config();

const { sendMail } = await import('../src/lib/mailer.js');
const { getNotificationSettings } = await import('../src/lib/notification-settings.js');

const settings = getNotificationSettings();
console.log(`SMTP: ${settings.smtp.host || 'nicht konfiguriert (Datei-Fallback)'}`);
console.log(`Empfänger: ${settings.smtp.to || 'Standard'}`);

const result = await sendMail({
  subject: '[Test] Benachrichtigung von 3D-MIR',
  text: [
    'Dies ist eine Testnachricht.',
    '',
    `Zeitpunkt: ${new Date().toLocaleString('de-DE')}`,
    '',
    'Wenn Sie diese Nachricht erhalten, ist der E-Mail-Versand eingerichtet.',
  ].join('\n'),
});

if (result.delivered) {
  console.log('Test-E-Mail wurde versendet.');
} else {
  console.log(`Kein SMTP konfiguriert. Test-E-Mail gespeichert unter: ${result.savedTo ?? 'unbekannt'}`);
}
