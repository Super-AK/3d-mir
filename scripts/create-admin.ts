/**
 * Legt einen Admin-Zugang an oder setzt dessen Passwort zurück.
 *
 * Aufruf (produktiv, als Dienstbenutzer):
 *   sudo -u mir3d npm run admin:create -- --email admin@example.de --name "Betreiber"
 *
 * Das Passwort wird interaktiv abgefragt und nicht im Repository gespeichert.
 * Für automatisierte Installationen kann es einmalig über die Umgebungsvariable
 * ADMIN_PASSWORD übergeben werden; sie wird nicht protokolliert.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import dotenv from 'dotenv';

const envFile = process.env.ENV_FILE ?? '/etc/3d-mir/3d-mir.env';
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });
dotenv.config();

const { config } = await import('../src/config.js');
const { migrate } = await import('../src/db/migrate.js');
const { getDb, closeDb } = await import('../src/db/index.js');
const { hashPassword, writeAudit } = await import('../src/lib/auth.js');

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (!stdin.isTTY) {
      reject(new Error('Kein Terminal für die Passworteingabe verfügbar. Bitte ADMIN_PASSWORD setzen.'));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    const cleanup = (): void => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    };

    const onData = (input: string): void => {
      for (const char of input) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Abgebrochen.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= ' ') value += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string>((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
  }
}

const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const name = (arg('name') ?? process.env.ADMIN_NAME ?? '').trim();
const role = arg('role') === 'support' ? 'support' : 'admin';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Bitte eine gültige E-Mail-Adresse angeben: --email admin@example.de');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? '';
if (!password) {
  password = await promptHidden('Passwort (mindestens 12 Zeichen): ');
  const repeat = await promptHidden('Passwort wiederholen: ');
  if (password !== repeat) {
    console.error('Die Passwörter stimmen nicht überein.');
    process.exit(1);
  }
}

if (password.length < 12) {
  console.error('Das Passwort muss mindestens 12 Zeichen lang sein.');
  process.exit(1);
}

migrate();
const db = getDb();
const hash = await hashPassword(password);

db.prepare(
  `INSERT INTO users (email, password_hash, name, role)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(email) DO UPDATE SET
     password_hash = excluded.password_hash,
     name = excluded.name,
     role = excluded.role,
     updated_at = datetime('now')`,
).run(email, hash, name, role);

const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number };
// Nach einer Passwortänderung alle bestehenden Sitzungen beenden.
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
writeAudit(email, 'admin.create', { name, database: config.dbPath });

console.log(`${role === 'support' ? 'Support' : 'Admin'}-Zugang für ${email} ist eingerichtet.`);
console.log(`Datenbank: ${config.dbPath}`);
closeDb();
