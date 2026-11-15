import { escapeHtml } from './http.js';

/**
 * Einheitliches HTML-Layout für Benachrichtigungen und Bestätigungen.
 *
 * Die Gestaltung nutzt ausschließlich Inline-Styles und Tabellen, damit sie
 * auch in gängigen E-Mail-Programmen zuverlässig dargestellt wird.
 */

export type MailRow = [label: string, value: string];

export function mailLayout(options: {
  title: string;
  preheader?: string;
  body: string;
  footer?: string;
}): string {
  const footer =
    options.footer ??
    '3D-MIR 3D-Druck Service · Diese Nachricht wurde automatisch erstellt.';
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${options.preheader ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</span>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dde4ee;">
        <tr>
          <td style="background:#0a1530;padding:18px 24px;color:#ffffff;">
            <span style="font-size:18px;font-weight:700;letter-spacing:0.02em;">3D-MIR</span>
            <span style="font-size:12px;color:#a9bbd4;padding-left:8px;text-transform:uppercase;letter-spacing:0.12em;">3D-Druck Service</span>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 24px;">
            <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0a1530;">${escapeHtml(options.title)}</h1>
            ${options.body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e8eef6;color:#64748b;font-size:12px;line-height:1.5;">
            ${escapeHtml(footer)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function mailSection(title: string, body: string): string {
  return `<h2 style="margin:24px 0 10px;padding-top:18px;border-top:1px solid #e8eef6;font-size:16px;line-height:1.3;color:#0a1530;">${escapeHtml(title)}</h2>${body}`;
}

export function mailTable(rows: MailRow[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:5px 0;color:#64748b;font-size:13px;vertical-align:top;width:38%;">${escapeHtml(label)}</td><td style="padding:5px 0;color:#172033;font-size:13px;vertical-align:top;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('')}</table>`;
}

export function mailParagraph(text: string): string {
  return `<p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

export function mailNotice(text: string): string {
  return `<p style="margin:0 0 12px;padding:10px 12px;background:#eef5fc;border-left:3px solid #2f6fa8;color:#1f3b57;font-size:13px;line-height:1.55;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

export function mailButton(href: string, label: string): string {
  return `<p style="margin:16px 0 6px;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 18px;border-radius:8px;background:#2f6fa8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

export function mailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#2f6fa8;text-decoration:underline;">${escapeHtml(label)}</a>`;
}
