import { escapeHtml } from './http.js';
import { countryName } from './countries.js';
import { mailLayout, mailLink, mailNotice, mailParagraph, mailSection, mailTable } from './mail-layout.js';

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
  return mailLayout({
    title: 'Neue Kontaktanfrage',
    preheader: `${data.name} · ${data.subject}`,
    body: [
      mailSection('Kontakt', mailTable([
        ['Name', data.name],
        ['E-Mail', data.email],
        ['Telefon', data.phone || '–'],
        ['Land', data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt'],
        ['Anliegen', data.subject],
      ])),
      mailSection('Nachricht', mailParagraph(data.message)),
      mailParagraph(`Antworten Sie direkt auf diese E-Mail, um ${data.name} zu kontaktieren.`),
    ].join(''),
  });
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
  return mailLayout({
    title: 'Kontaktanfrage zur Prüfung',
    preheader: `${data.name} · ${data.subject}`,
    body: [
      mailNotice('Eine Kontaktanfrage wurde nicht automatisch weitergeleitet.'),
      mailSection('Kontakt', mailTable([
        ['Name', data.name],
        ['E-Mail', data.email],
        ['Land', data.country ? `${countryName(data.country)} (${data.country})` : 'unbekannt'],
        ['Anliegen', data.subject],
      ])),
      mailSection('Gründe', `<ul style="margin:0 0 10px;padding-left:20px;color:#334155;font-size:13px;line-height:1.6;">${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`),
      mailParagraph(adminUrl),
    ].join(''),
  });
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
  return mailLayout({
    title: 'Vielen Dank für Ihre Nachricht',
    preheader: `Ihre Anfrage ${data.subject} ist bei 3D-MIR eingegangen.`,
    body: [
      mailParagraph(`Hallo ${data.name},`),
      mailParagraph('vielen Dank für Ihre Nachricht an 3D-MIR. Wir haben Ihre Anfrage erhalten und melden uns in der Regel innerhalb von 24 Stunden an Werktagen.'),
      mailSection('Ihr Anliegen', mailParagraph(data.subject)),
      mailSection('Rechtliche Informationen', `<p style="margin:0;font-size:13px;line-height:1.7;">${mailLink(`${baseUrl}/agb/`, 'AGB')}<br>${mailLink(`${baseUrl}/widerruf/`, 'Widerrufsbelehrung')}<br>${mailLink(`${baseUrl}/widerruf/formular.pdf`, 'Muster-Widerrufsformular (PDF)')}<br>${mailLink(`${baseUrl}/datenschutz/`, 'Datenschutz')}</p>`),
      mailParagraph('Viele Grüße\n3D-MIR 3D-Druck Service'),
    ].join(''),
  });
}
