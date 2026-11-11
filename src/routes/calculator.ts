import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { render } from '../lib/render.js';
import { sendMail } from '../lib/mailer.js';
import { cleanText, createReference, escapeHtml, isSameOrigin } from '../lib/http.js';
import { MeshError, parseMesh, type MeshFormat } from '../lib/mesh.js';
import { calculatePrice, choosePrinter, type PriceMetrics, type PriceOptions } from '../lib/pricing.js';

type UploadedFile = { buffer: Buffer; filename: string; mimetype: string };
type MultipartData = { fields: Record<string, string>; file: UploadedFile | null };

const calculatorConfig = {
  meta: config.pricing.meta,
  calculation: config.pricing.calculation,
  materials: config.pricing.materials.map(({ id, label, density, pricePerGram, colors }) => ({
    id,
    label,
    density,
    pricePerGram,
    colors,
  })),
  printers: config.pricing.printers.map(({ id, label, buildVolume, hourlyRate, materialIds }) => ({
    id,
    label,
    buildVolume,
    hourlyRate,
    materialIds,
  })),
  coatings: config.pricing.coatings,
  quantityDiscounts: config.pricing.quantityDiscounts,
  infillOptions: config.pricing.infillOptions,
  layerHeightOptions: config.pricing.layerHeightOptions,
};

const quoteSchema = z.object({
  name: z.string().min(2, 'Bitte geben Sie Ihren Namen an.').max(120),
  email: z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse an.').max(200),
  phone: z.string().max(60),
  company: z.string().max(160),
  message: z.string().max(3000),
  materialId: z.string().min(1),
  printerId: z.string().min(1),
  color: z.string().max(80),
  infill: z.coerce.number().int().min(0).max(100),
  layerHeight: z.coerce.number().min(0.05).max(0.6),
  quantity: z.coerce.number().int().min(1).max(500),
  coating: z.string().min(1),
  scalePercent: z.coerce.number().min(10).max(400),
  unit: z.enum(['mm', 'inch']),
  consent: z.literal('1', {
    errorMap: () => ({ message: 'Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.' }),
  }),
});

function field(fields: Record<string, string>, name: string, maxLength = 500): string {
  return cleanText(fields[name], maxLength);
}

function quoteOptions(fields: Record<string, string>): PriceOptions {
  return {
    materialId: field(fields, 'materialId', 40),
    printerId: field(fields, 'printerId', 40),
    infill: Number(fields.infill ?? 20),
    layerHeight: Number(fields.layerHeight ?? 0.2),
    quantity: Number(fields.quantity ?? 1),
    coatingId: field(fields, 'coating', 40) || 'none',
    scalePercent: Number(fields.scalePercent ?? 100),
  };
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

async function readMultipart(request: FastifyRequest): Promise<MultipartData> {
  const fields: Record<string, string> = {};
  let file: UploadedFile | null = null;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (part.fieldname !== 'model' || file) {
        part.file.resume();
        continue;
      }
      const buffer = await part.toBuffer();
      file = {
        buffer,
        filename: path.basename(part.filename || 'modell'),
        mimetype: part.mimetype,
      };
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }

  return { fields, file };
}

function safeFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'modell';
}

function jsonError(reply: import('fastify').FastifyReply, status: number, message: string) {
  return reply.code(status).send({ ok: false, error: message });
}

function meshErrorMessage(error: unknown): string {
  if (error instanceof MeshError) return error.message;
  return 'Die Datei konnte nicht verarbeitet werden. Bitte prüfen Sie das Modell.';
}

export async function calculatorRoutes(app: FastifyInstance): Promise<void> {
  app.get('/3d-druck-rechner/', async (_request, reply) => {
    render(reply, 'pages/rechner.njk', {
      calculatorConfig,
      maxUploadMb: Math.round(config.maxUploadBytes / (1024 * 1024)),
    });
  });

  app.post(
    '/3d-druck-rechner/analyse/',
    { config: { rateLimit: { max: 40, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!isSameOrigin(request)) return jsonError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');

      let data: MultipartData;
      try {
        data = await readMultipart(request);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return jsonError(reply, 413, `Die Datei ist zu groß (maximal ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB).`);
        }
        return jsonError(reply, 400, 'Die Datei konnte nicht gelesen werden.');
      }

      if (!data.file) return jsonError(reply, 400, 'Bitte wählen Sie eine Modell-Datei aus.');

      let parsed;
      try {
        parsed = parseMesh(data.file.buffer, data.file.filename);
      } catch (error) {
        request.log.warn({ err: error, filename: data.file.filename }, 'Modell konnte nicht analysiert werden');
        return jsonError(reply, 422, meshErrorMessage(error));
      }

      const options = quoteOptions(data.fields);
      const suggestedPrinterId =
        choosePrinter(parsed.metrics.dimensionsMm, options.materialId, config.pricing.printers, options.scalePercent) ??
        config.pricing.printers[0]?.id ??
        null;

      return reply.send({
        ok: true,
        format: parsed.format,
        metrics: parsed.metrics,
        suggestedPrinterId,
        filename: safeFilename(data.file.filename),
        size: data.file.buffer.length,
      });
    },
  );

  app.post(
    '/3d-druck-rechner/anfrage/',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!isSameOrigin(request)) return jsonError(reply, 403, 'Die Anfrage konnte nicht zugeordnet werden.');

      let data: MultipartData;
      try {
        data = await readMultipart(request);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return jsonError(reply, 413, `Die Datei ist zu groß (maximal ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB).`);
        }
        return jsonError(reply, 400, 'Die Anfrage konnte nicht gelesen werden.');
      }

      if (!data.file) return jsonError(reply, 400, 'Bitte wählen Sie eine Modell-Datei aus.');

      const fields = data.fields;
      const parsed = quoteSchema.safeParse({
        name: field(fields, 'name', 120),
        email: field(fields, 'email', 200),
        phone: field(fields, 'phone', 60),
        company: field(fields, 'company', 160),
        message: field(fields, 'message', 3000),
        materialId: field(fields, 'materialId', 40),
        printerId: field(fields, 'printerId', 40),
        color: field(fields, 'color', 80),
        infill: fields.infill,
        layerHeight: fields.layerHeight,
        quantity: fields.quantity,
        coating: field(fields, 'coating', 40),
        scalePercent: fields.scalePercent,
        unit: field(fields, 'unit', 10),
        consent: fields.consent,
      });

      if (!parsed.success) {
        return jsonError(reply, 400, parsed.error.issues[0]?.message ?? 'Bitte prüfen Sie Ihre Angaben.');
      }
      const input = parsed.data;

      const material = config.pricing.materials.find((item) => item.id === input.materialId);
      const printer = config.pricing.printers.find((item) => item.id === input.printerId);
      const coating = config.pricing.coatings.find((item) => item.id === input.coating);
      if (!material || !printer || !coating) {
        return jsonError(reply, 400, 'Bitte wählen Sie Material, Drucker und Nachbearbeitung erneut aus.');
      }

      let parsedMesh;
      try {
        parsedMesh = parseMesh(data.file.buffer, data.file.filename);
      } catch (error) {
        request.log.warn({ err: error, filename: data.file.filename }, 'Modell konnte nicht verarbeitet werden');
        return jsonError(reply, 422, meshErrorMessage(error));
      }

      const options: PriceOptions = {
        materialId: input.materialId,
        printerId: input.printerId,
        infill: input.infill,
        layerHeight: input.layerHeight,
        quantity: input.quantity,
        coatingId: input.coating,
        scalePercent: input.scalePercent,
      };
      const price = calculatePrice(parsedMesh.metrics, options, config.pricing);

      const reference = createReference('ANF');
      const sha256 = crypto.createHash('sha256').update(data.file.buffer).digest('hex');
      const storedName = `${reference}-${sha256.slice(0, 12)}.${parsedMesh.format}`;
      const relativePath = path.join('quotes', storedName);
      const absolutePath = path.join(config.uploadDir, relativePath);

      try {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, data.file.buffer, { mode: 0o640, flag: 'wx' });
      } catch (error) {
        request.log.error({ err: error }, 'Upload konnte nicht gespeichert werden');
        return jsonError(reply, 500, 'Die Datei konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
      }

      const dimensions = JSON.stringify({
        ...price.dimensionsMm,
        original: parsedMesh.metrics.dimensionsMm,
        unit: input.unit,
      });

      try {
        getDb()
          .prepare(
            `INSERT INTO quote_requests
              (reference, name, email, phone, company, message, material_id, color, printer_id, infill,
               layer_height, quantity, coating, scale_percent, unit, dimensions, volume_cm3, surface_cm2,
               weight_g, estimated_price_cents, file_path, file_name, file_size, file_sha256, consent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            reference,
            input.name,
            input.email,
            input.phone,
            input.company,
            input.message,
            input.materialId,
            input.color,
            input.printerId,
            input.infill,
            input.layerHeight,
            input.quantity,
            input.coating,
            input.scalePercent,
            input.unit,
            dimensions,
            parsedMesh.metrics.volumeCm3,
            parsedMesh.metrics.surfaceCm2,
            price.weightG,
            price.totalCents,
            relativePath,
            safeFilename(data.file.filename),
            data.file.buffer.length,
            sha256,
            new Date().toISOString(),
          );
      } catch (error) {
        request.log.error({ err: error }, 'Anfrage konnte nicht gespeichert werden');
        fs.rmSync(absolutePath, { force: true });
        return jsonError(reply, 500, 'Die Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
      }

      const summaryLines = [
        `Referenz: ${reference}`,
        `Name: ${input.name}`,
        `E-Mail: ${input.email}`,
        `Telefon: ${input.phone || '–'}`,
        `Firma: ${input.company || '–'}`,
        '',
        `Material: ${material.label}`,
        `Drucker: ${printer.label}`,
        `Farbe: ${input.color || '–'}`,
        `Füllung: ${input.infill} %`,
        `Schichthöhe: ${input.layerHeight} mm`,
        `Stückzahl: ${input.quantity}`,
        `Nachbearbeitung: ${coating.label}`,
        `Skalierung: ${input.scalePercent} %`,
        `Maße: ${price.dimensionsMm.x} × ${price.dimensionsMm.y} × ${price.dimensionsMm.z} mm`,
        `Gewicht (geschätzt): ${price.weightG} g`,
        `Druckzeit (geschätzt): ${price.printHours} h`,
        `Preis (unverbindlich): ${formatEuro(price.totalCents)}`,
        '',
        'Kalkulation:',
        ...price.breakdown.map((item) => `- ${item.label}: ${formatEuro(item.cents)}`),
        '',
        `Datei: ${relativePath} (${safeFilename(data.file.filename)}, ${(data.file.buffer.length / 1024 / 1024).toFixed(1)} MB)`,
        `SHA-256: ${sha256}`,
        '',
        'Nachricht:',
        input.message || '–',
      ];

      try {
        await sendMail({
          subject: `[Anfrage ${reference}] ${material.label} · ${input.quantity} Teile`,
          text: summaryLines.join('\n'),
          replyTo: input.email,
        });
        await sendMail({
          to: input.email,
          subject: `Ihre Anfrage ${reference} bei 3D-MIR`,
          text: [
            `Hallo ${input.name},`,
            '',
            'vielen Dank für Ihre Anfrage. Wir haben folgende Angaben erhalten:',
            '',
            `Referenz: ${reference}`,
            `Material: ${material.label}, ${input.color || 'Farbe nach Absprache'}`,
            `Stückzahl: ${input.quantity}`,
            `Maße: ${price.dimensionsMm.x} × ${price.dimensionsMm.y} × ${price.dimensionsMm.z} mm`,
            `Unverbindliche Preisschätzung: ${formatEuro(price.totalCents)}`,
            '',
            'Wir prüfen das Modell und melden uns in der Regel innerhalb eines Werktags mit einem verbindlichen Angebot.',
            '',
            'Viele Grüße',
            '3D-MIR 3D-Druck Service',
          ].join('\n'),
          replyTo: config.mail.to,
        });
      } catch (error) {
        request.log.error({ err: error, reference }, 'Anfrage gespeichert, aber E-Mail-Versand fehlgeschlagen');
      }

      request.log.info({ reference, priceCents: price.totalCents }, 'Angebotsanfrage gespeichert');
      return reply.code(201).send({ ok: true, reference, priceCents: price.totalCents });
    },
  );

  app.get('/3d-druck-rechner/danke/', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const raw = typeof query.reference === 'string' ? query.reference : '';
    const reference = /^ANF-[A-Z2-9]{5}$/.test(raw) ? raw : null;
    render(reply, 'pages/rechner-danke.njk', { reference });
  });
}
