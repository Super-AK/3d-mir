import PDFDocument from 'pdfkit';
import { getSiteSettings } from './site-settings.js';

/**
 * Erzeugt das Muster-Widerrufsformular als PDF.
 *
 * Die Geschäftsdaten stammen aus den im Admin gepflegten Stammdaten, damit
 * Adresse und Kontaktangaben automatisch aktuell sind.
 */
export async function createWithdrawalFormPdf(): Promise<Buffer> {
  const site = getSiteSettings();
  const business = site.business;
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 55, bottom: 55, left: 60, right: 60 },
    info: {
      Title: 'Muster-Widerrufsformular – 3D-MIR',
      Author: business.legalName,
      Subject: 'Widerrufsformular',
      Creator: '3D-MIR',
    },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  const paragraph = (text: string): void => {
    doc.font('Helvetica').fontSize(10.5).fillColor('#111111').text(text, { lineGap: 2 });
  };

  const field = (label: string, height = 16): void => {
    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(10.5).fillColor('#111111').text(label);
    const y = doc.y + 5;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#999999').lineWidth(0.6).stroke();
    doc.y = y + height;
  };

  // Kopf
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text('Muster-Widerrufsformular');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`${business.legalName} · ${business.street} · ${business.zip} ${business.city}`);
  doc.moveDown(1);

  paragraph('Wenn Sie den Vertrag widerrufen wollen, füllen Sie bitte dieses Formular aus und senden Sie es an:');
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111111').text(
    [
      business.legalName,
      business.owner ? `z. Hd. ${business.owner}` : '',
      business.street,
      `${business.zip} ${business.city}`,
      business.country,
      `E-Mail: ${business.email}`,
      business.phone ? `Telefon: ${business.phone}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    { lineGap: 1 },
  );
  doc.moveDown(1);

  paragraph(
    'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*):',
  );
  const boxY = doc.y + 6;
  doc.rect(left, boxY, width, 74).strokeColor('#999999').lineWidth(0.6).stroke();
  doc.y = boxY + 82;

  field('Bestellt am (*):');
  field('Erhalten am (*):');
  field('Bestellnummer (optional):');
  field('Name des/der Verbraucher(s):');
  field('Anschrift des/der Verbraucher(s):');
  field('E-Mail/Telefon (für Rückfragen):');
  field('Datum:');
  field('Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):', 24);

  doc.moveDown(0.8);
  paragraph('(*) Unzutreffendes streichen.');
  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555').text(
    `Hinweis: Sie können das Formular per Post oder ausgefüllt und eingescannt per E-Mail senden. Die gesetzliche Widerrufsfrist beträgt 14 Tage; die vollständige Widerrufsbelehrung finden Sie unter ${site.baseUrl}/widerruf/ auf unserer Website.`,
    { lineGap: 1.5 },
  );

  doc.end();
  return finished;
}
