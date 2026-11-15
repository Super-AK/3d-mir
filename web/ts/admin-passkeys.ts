import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

/**
 * Passkeys im Admin-Bereich: Registrierung unter „Passwort und Sicherheit“
 * und Anmeldung auf der 2FA-Seite. Alle kryptografischen Prüfungen finden
 * serverseitig statt; der Browser liefert nur die WebAuthn-Antwort.
 */

type JsonRecord = Record<string, unknown> & { ok?: boolean; error?: string; redirect?: string };

async function postJson(url: string, body: unknown): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let data: JsonRecord = {};
  try {
    data = (await response.json()) as JsonRecord;
  } catch {
    // Fehler unten als allgemeine Meldung behandeln.
  }
  if (!response.ok || data.ok === false) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Die Anfrage ist fehlgeschlagen.');
  }
  return data;
}

function friendlyError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') return 'Der Vorgang wurde abgebrochen oder ist abgelaufen. Bitte erneut versuchen.';
  if (name === 'InvalidStateError') return 'Dieser Passkey ist auf dem Gerät bereits hinterlegt.';
  if (name === 'SecurityError') return 'Passkeys benötigen eine sichere Verbindung (HTTPS).';
  if (name === 'NotSupportedError') return 'Dieses Gerät oder dieser Browser unterstützt keine Passkeys.';
  return error instanceof Error ? error.message : 'Der Passkey-Vorgang ist fehlgeschlagen.';
}

function showError(box: HTMLElement | null, message: string): void {
  if (!box) return;
  const paragraph = box.querySelector('p');
  if (paragraph) paragraph.textContent = message;
  box.hidden = false;
}

function hideError(box: HTMLElement | null): void {
  if (box) box.hidden = true;
}

function initRegistration(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-passkey-add]');
  if (!button) return;

  const errorBox = document.querySelector<HTMLElement>('[data-passkey-error]');
  const labelInput = document.querySelector<HTMLInputElement>('[data-passkey-label]');
  button.addEventListener('click', async () => {
    hideError(errorBox);
    if (!browserSupportsWebAuthn()) {
      showError(errorBox, 'Dieser Browser unterstützt keine Passkeys. Bitte einen aktuellen Browser über HTTPS verwenden.');
      return;
    }
    const csrf = document.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
    button.disabled = true;
    try {
      const options = await postJson('/admin/passwort/passkey/optionen/', { _csrf: csrf });
      const response = await startRegistration({
        optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      await postJson('/admin/passwort/passkey/registrieren/', {
        _csrf: csrf,
        label: labelInput?.value ?? '',
        response,
      });
      window.location.assign('/admin/passwort/?gespeichert=1');
    } catch (error) {
      showError(errorBox, friendlyError(error));
      button.disabled = false;
    }
  });
}

function initLogin(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-passkey-login]');
  if (!button) return;

  const errorBox = document.querySelector<HTMLElement>('[data-passkey-error]');
  button.addEventListener('click', async () => {
    hideError(errorBox);
    if (!browserSupportsWebAuthn()) {
      showError(errorBox, 'Dieser Browser unterstützt keine Passkeys. Bitte einen aktuellen Browser über HTTPS verwenden.');
      return;
    }
    button.disabled = true;
    try {
      const options = await postJson('/admin/login/passkey/optionen/', {});
      const response = await startAuthentication({
        optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      const result = await postJson('/admin/login/passkey/verifizieren/', {
        response,
        weiter: button.dataset.weiter ?? '/admin/',
      });
      window.location.assign(result.redirect ?? '/admin/');
    } catch (error) {
      showError(errorBox, friendlyError(error));
      button.disabled = false;
    }
  });
}

initRegistration();
initLogin();
