import { escapeHtml } from './http.js';
import { countryName } from './countries.js';

export type ContactMailData = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  country: string;
};

/** Klartext für die Betreiber-Benachrichtigung einer Kontaktanfrage. */
export function contactMailText(data: ContactMailData): string {
  return [
    'Neue Kontaktanfrage über 3d-mir.de',
    '',
    `Name:    ${data.name}`,
    `E-Mail:  ${data.email}`,
    `Telefon: ${data.phone || '–'}`,
    `Land:    ${data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt'}`,
    `Anliegen: ${data.subject}`,
    '',
    data.message,
  ].join('\n');
}

/** HTML für die Betreiber-Benachrichtigung einer Kontaktanfrage. */
export function contactMailHtml(data: ContactMailData): string {
  const rows = [
    ['Name', data.name],
    ['E-Mail', data.email],
    ['Telefon', data.phone || '–'],
    ['Land', data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt'],
    ['Anliegen', data.subject],
  ]
    .map(([label, value]) => `<tr><th align="left">${escapeHtml(label!)}</th><td>${escapeHtml(value!)}</td></tr>`)
    .join('');
  return `<h1>Neue Kontaktanfrage</h1>
<table cellpadding="6">${rows}</table>
<p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>`;
}

/** Kurze Benachrichtigung, dass eine Nachricht auf Prüfung wartet. */
export function contactReviewMailText(data: ContactMailData, reasons: string[], adminUrl: string): string {
  return [
    'Eine Kontaktanfrage wartet auf Prüfung.',
    '',
    `Name:    ${data.name}`,
    `E-Mail:  ${data.email}`,
    `Land:    ${data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt'}`,
    `Anliegen: ${data.subject}`,
    '',
    'Gründe:',
    ...reasons.map((reason) => `- ${reason}`),
    '',
    'Die Nachricht wurde nicht automatisch weitergeleitet. Bitte im Admin-Bereich prüfen und freigeben oder als Spam markieren:',
    adminUrl,
  ].join('\n');
}

/** HTML-Variante der Prüf-Benachrichtigung. */
export function contactReviewMailHtml(data: ContactMailData, reasons: string[], adminUrl: string): string {
  return `<h1>Kontaktanfrage zur Prüfung</h1>
<p>Eine Kontaktanfrage wurde nicht automatisch weitergeleitet.</p>
<table cellpadding="6">
<tr><th align="left">Name</th><td>${escapeHtml(data.name)}</td></tr>
<tr><th align="left">E-Mail</th><td>${escapeHtml(data.email)}</td></tr>
<tr><th align="left">Land</th><td>${escapeHtml(data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt')}</td></tr>
<tr><th align="left">Anliegen</th><td>${escapeHtml(data.subject)}</td></tr>
</table>
<p><strong>Gründe:</strong></p>
<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
<p><a href="${escapeHtml(adminUrl)}">Im Admin-Bereich prüfen</a></p>`;
}


/** Automatische Eingangsbestätigung an den Absender des Kontaktformulars. */
export function contactAcknowledgementText(data: ContactMailData, baseUrl: string): string {
  return [
    `Hallo ${data.name},`,
    '',
    'vielen Dank für Ihre Nachricht an 3D-MIR. Wir haben Ihre Anfrage erhalten und melden uns in der Regel innerhalb von 24 Stunden an Werktagen.',
    '',
    `Ihr Anliegen: ${data.subject}`,
    '',
    'Rechtliche Informationen:',
    `AGB: ${baseUrl}/agb/`,
    `Widerrufsbelehrung: ${baseUrl}/widerruf/`,
    `Muster-Widerrufsformular (PDF): ${baseUrl}/widerruf/formular.pdf`,
    `Datenschutz: ${baseUrl}/datenschutz/`,
    '',
    'Viele Grüße',
    '3D-MIR 3D-Druck Service',
  ].join('\n');
}

/** HTML-Variante der automatischen Eingangsbestätigung. */
export function contactAcknowledgementHtml(data: ContactMailData, baseUrl: string): string {
  const link = (href: string, label: string): string =>
    `<a href="${escapeHtml(`${baseUrl}${href}`)}">${escapeHtml(label)}</a>`;
  return `<h1>Vielen Dank für Ihre Nachricht</h1>
<p>Hallo ${escapeHtml(data.name)},</p>
<p>vielen Dank für Ihre Nachricht an 3D-MIR. Wir haben Ihre Anfrage erhalten und melden uns in der Regel innerhalb von 24 Stunden an Werktagen.</p>
<p><strong>Ihr Anliegen:</strong> ${escapeHtml(data.subject)}</p>
<p><strong>Rechtliche Informationen:</strong><br>
${link('/agb/', 'AGB')}<br>
${link('/widerruf/', 'Widerrufsbelehrung')}<br>
${link('/widerruf/formular.pdf', 'Muster-Widerrufsformular (PDF)')}<br>
${link('/datenschutz/', 'Datenschutz')}</p>
<p>Viele Grüße<br>3D-MIR 3D-Druck Service</p>`;
}
