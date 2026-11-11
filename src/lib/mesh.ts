import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

export type MeshFormat = 'stl' | 'obj' | '3mf';

export type MeshMetrics = {
  /** Volumen in cm³ (aus der geschlossenen Dreiecksfläche). */
  volumeCm3: number;
  /** Oberfläche in cm². */
  surfaceCm2: number;
  /** Kantenlängen des achsenparallelen Bounding-Box in mm. */
  dimensionsMm: { x: number; y: number; z: number };
  triangles: number;
};

export type ParsedMesh = {
  format: MeshFormat;
  metrics: MeshMetrics;
};

/** Schutzgrenzen gegen übergroße oder bösartige Dateien. */
const MAX_TRIANGLES = 2_000_000;
const MAX_VERTICES = 4_000_000;
const MAX_DIMENSION_MM = 5_000;
const MAX_UNZIPPED_BYTES = 150 * 1024 * 1024;

export class MeshError extends Error {
  constructor(
    message: string,
    public readonly code: 'format' | 'geometry' | 'too_large' = 'geometry',
  ) {
    super(message);
    this.name = 'MeshError';
  }
}

type Vec3 = [number, number, number];

class MeshAccumulator {
  volumeMm3 = 0;
  surfaceMm2 = 0;
  triangles = 0;
  min: Vec3 = [Infinity, Infinity, Infinity];
  max: Vec3 = [-Infinity, -Infinity, -Infinity];

  add(a: Vec3, b: Vec3, c: Vec3): void {
    this.triangles += 1;
    if (this.triangles > MAX_TRIANGLES) {
      throw new MeshError('Das Modell enthält zu viele Dreiecke (Maximum: 2 Millionen).', 'too_large');
    }

    // Signed volume of the tetrahedron (origin, a, b, c).
    this.volumeMm3 +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;

    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const abz = b[2] - a[2];
    const acx = c[0] - a[0];
    const acy = c[1] - a[1];
    const acz = c[2] - a[2];
    const cx = aby * acz - abz * acy;
    const cy = abz * acx - abx * acz;
    const cz = abx * acy - aby * acx;
    this.surfaceMm2 += Math.hypot(cx, cy, cz) / 2;

    for (let i = 0; i < 3; i += 1) {
      const values = [a[i]!, b[i]!, c[i]!];
      for (const value of values) {
        if (value < this.min[i]!) this.min[i] = value;
        if (value > this.max[i]!) this.max[i] = value;
      }
    }
  }

  result(): MeshMetrics {
    if (this.triangles === 0) {
      throw new MeshError('Die Datei enthält keine Dreiecke.');
    }
    const dimensions = {
      x: this.max[0] - this.min[0],
      y: this.max[1] - this.min[1],
      z: this.max[2] - this.min[2],
    };
    if (![dimensions.x, dimensions.y, dimensions.z].every(Number.isFinite)) {
      throw new MeshError('Die Maße des Modells konnten nicht ermittelt werden.');
    }
    if (Math.max(dimensions.x, dimensions.y, dimensions.z) > MAX_DIMENSION_MM) {
      throw new MeshError('Das Modell ist größer als 5 Meter und wird nicht angenommen.', 'too_large');
    }

    const volumeCm3 = Math.abs(this.volumeMm3) / 1000;
    if (volumeCm3 < 0.001) {
      throw new MeshError('Das Modell hat kein nutzbares Volumen. Bitte prüfen Sie, ob alle Flächen geschlossen sind.');
    }

    return {
      volumeCm3: round(volumeCm3, 4),
      surfaceCm2: round(this.surfaceMm2 / 100, 3),
      dimensionsMm: {
        x: round(dimensions.x, 2),
        y: round(dimensions.y, 2),
        z: round(dimensions.z, 2),
      },
      triangles: this.triangles,
    };
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Erkennt das Format anhand der Endung und des Inhalts (keine reinen Dateiendungen vertrauen). */
export function detectMeshFormat(buffer: Buffer, filename: string): MeshFormat | null {
  const extension = filename.toLowerCase().split('.').pop() ?? '';

  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return '3mf';
  }

  if (buffer.length >= 84) {
    const triangleCount = buffer.readUInt32LE(80);
    if (triangleCount > 0 && triangleCount <= MAX_TRIANGLES && 84 + triangleCount * 50 === buffer.length) {
      return 'stl';
    }
  }

  const head = buffer.subarray(0, 4096).toString('utf8').trimStart();
  if (/^solid\b/i.test(head) && /facet\s+normal/i.test(head)) return 'stl';
  if (/^(?:#|v\s|vn\s|vt\s|o\s|g\s|mtllib\s|usemtl\s|s\s)/m.test(head) && /\n\s*f\s/.test(head)) {
    return 'obj';
  }

  // Endung nur als letzter Hinweis, wenn der Inhalt plausibel ist.
  if (extension === 'obj' && !buffer.includes(0)) return 'obj';
  return null;
}

function parseStl(buffer: Buffer): MeshMetrics {
  const acc = new MeshAccumulator();
  const triangleCount = buffer.length >= 84 ? buffer.readUInt32LE(80) : 0;

  if (triangleCount > 0 && 84 + triangleCount * 50 === buffer.length) {
    if (triangleCount > MAX_TRIANGLES) {
      throw new MeshError('Das Modell enthält zu viele Dreiecke (Maximum: 2 Millionen).', 'too_large');
    }
    for (let i = 0; i < triangleCount; i += 1) {
      const offset = 84 + i * 50 + 12;
      acc.add(
        [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)],
        [buffer.readFloatLE(offset + 12), buffer.readFloatLE(offset + 16), buffer.readFloatLE(offset + 20)],
        [buffer.readFloatLE(offset + 24), buffer.readFloatLE(offset + 28), buffer.readFloatLE(offset + 32)],
      );
    }
    return acc.result();
  }

  // ASCII-STL: alle "vertex x y z"-Tripel einlesen.
  const text = buffer.toString('utf8');
  const vertexPattern = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const vertices: Vec3[] = [];
  let match: RegExpExecArray | null;
  while ((match = vertexPattern.exec(text)) !== null) {
    vertices.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    if (vertices.length > MAX_VERTICES) {
      throw new MeshError('Das Modell enthält zu viele Eckpunkte.', 'too_large');
    }
  }
  if (vertices.length === 0 || vertices.length % 3 !== 0) {
    throw new MeshError('Die STL-Datei konnte nicht gelesen werden.');
  }
  for (let i = 0; i < vertices.length; i += 3) {
    acc.add(vertices[i]!, vertices[i + 1]!, vertices[i + 2]!);
  }
  return acc.result();
}

function parseObj(buffer: Buffer): MeshMetrics {
  const text = buffer.toString('utf8');
  if (text.includes('\u0000')) throw new MeshError('Die OBJ-Datei ist keine Textdatei.');

  const vertices: Vec3[] = [];
  const acc = new MeshAccumulator();

  const resolveIndex = (token: string): number => {
    const raw = Number(token.split('/')[0]);
    if (!Number.isInteger(raw) || raw === 0) return -1;
    return raw > 0 ? raw - 1 : vertices.length + raw;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v') {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (![x, y, z].every(Number.isFinite)) continue;
      vertices.push([x, y, z]);
      if (vertices.length > MAX_VERTICES) {
        throw new MeshError('Das Modell enthält zu viele Eckpunkte.', 'too_large');
      }
    } else if (parts[0] === 'f') {
      const indices = parts.slice(1).map(resolveIndex).filter((index) => index >= 0 && index < vertices.length);
      if (indices.length < 3) continue;
      // Polygone als Fächer triangulieren.
      for (let i = 1; i < indices.length - 1; i += 1) {
        acc.add(vertices[indices[0]!]!, vertices[indices[i]!]!, vertices[indices[i + 1]!]!);
      }
    }
  }

  return acc.result();
}

type Transform = number[];

const IDENTITY: Transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** 3MF-Transform (4×3, Zeilenvektor) in eine spaltenweise 4×4-Matrix umrechnen. */
function parseTransform(value: unknown): Transform {
  if (typeof value !== 'string') return IDENTITY;
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 12 || !parts.every(Number.isFinite)) return IDENTITY;
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22, m30, m31, m32] = parts as [
    number, number, number, number, number, number, number, number, number, number, number, number,
  ];
  return [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, 0, 0, 0, 1];
}

function multiply(a: Transform, b: Transform): Transform {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[row * 4 + k]! * b[k * 4 + col]!;
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

function applyTransform(matrix: Transform, point: Vec3): Vec3 {
  return [
    matrix[0]! * point[0] + matrix[1]! * point[1] + matrix[2]! * point[2] + matrix[3]!,
    matrix[4]! * point[0] + matrix[5]! * point[1] + matrix[6]! * point[2] + matrix[7]!,
    matrix[8]! * point[0] + matrix[9]! * point[1] + matrix[10]! * point[2] + matrix[11]!,
  ];
}

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function unitFactor(unit: unknown): number {
  switch (String(unit ?? 'millimeter').toLowerCase()) {
    case 'micron':
      return 0.001;
    case 'centimeter':
      return 10;
    case 'inch':
      return 25.4;
    case 'meter':
      return 1000;
    default:
      return 1;
  }
}

function parse3mf(buffer: Buffer): MeshMetrics {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (file) => file.name.endsWith('.model') && /^3D\//i.test(file.name),
    });
  } catch {
    throw new MeshError('Die 3MF-Datei ist beschädigt oder kein gültiges ZIP-Archiv.', 'format');
  }

  const modelNames = Object.keys(files);
  if (modelNames.length === 0) {
    throw new MeshError('Die 3MF-Datei enthält kein 3D-Modell.', 'format');
  }

  const unzippedSize = modelNames.reduce((sum, name) => sum + (files[name]?.length ?? 0), 0);
  if (unzippedSize > MAX_UNZIPPED_BYTES) {
    throw new MeshError('Die 3MF-Datei ist entpackt zu groß.', 'too_large');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => ['object', 'vertex', 'triangle', 'component', 'item', 'model'].includes(name),
  });

  const models: XmlNode[] = [];
  for (const name of modelNames) {
    const text = new TextDecoder().decode(files[name]);
    const parsed = parser.parse(text) as XmlNode;
    const nodes = asArray(parsed.model as XmlNode | XmlNode[] | undefined);
    models.push(...nodes);
  }
  if (models.length === 0) {
    throw new MeshError('Die 3MF-Datei enthält kein lesbares Modell.', 'format');
  }

  const acc = new MeshAccumulator();

  for (const model of models) {
    const factor = unitFactor(model.unit);
    const resources = (asArray(model.resources as XmlNode | XmlNode[] | undefined)[0] ?? {}) as XmlNode;
    const objects = asArray(resources.object as XmlNode | XmlNode[] | undefined);
    const byId = new Map<string, XmlNode>();
    for (const object of objects) {
      if (object.id !== undefined) byId.set(String(object.id), object);
    }

    const addObject = (id: string, parent: Transform, stack: string[]): void => {
      if (stack.includes(id)) throw new MeshError('Die 3MF-Datei enthält eine zyklische Komponentenreferenz.');
      if (stack.length > 32) throw new MeshError('Die 3MF-Datei ist zu tief verschachtelt.');
      const object = byId.get(id);
      if (!object) return;

      const mesh = (asArray(object.mesh as XmlNode | XmlNode[] | undefined)[0] ?? null) as XmlNode | null;
      if (mesh) {
        const vertices = asArray(mesh.vertices as XmlNode | XmlNode[] | undefined).flatMap((wrapper) =>
          asArray((wrapper as XmlNode).vertex as XmlNode | XmlNode[] | undefined),
        );
        const points: Vec3[] = vertices.map((vertex) => [
          Number(vertex.x) * factor,
          Number(vertex.y) * factor,
          Number(vertex.z) * factor,
        ]);
        if (points.length > MAX_VERTICES) {
          throw new MeshError('Das Modell enthält zu viele Eckpunkte.', 'too_large');
        }
        const triangles = asArray(mesh.triangles as XmlNode | XmlNode[] | undefined).flatMap((wrapper) =>
          asArray((wrapper as XmlNode).triangle as XmlNode | XmlNode[] | undefined),
        );
        for (const triangle of triangles) {
          const a = points[Number(triangle.v1)];
          const b = points[Number(triangle.v2)];
          const c = points[Number(triangle.v3)];
          if (!a || !b || !c) continue;
          acc.add(applyTransform(parent, a), applyTransform(parent, b), applyTransform(parent, c));
        }
      }

      const components = asArray(object.components as XmlNode | XmlNode[] | undefined).flatMap((wrapper) =>
        asArray((wrapper as XmlNode).component as XmlNode | XmlNode[] | undefined),
      );
      for (const component of components) {
        if (component.objectid === undefined) continue;
        const childMatrix = multiply(parent, parseTransform(component.transform));
        addObject(String(component.objectid), childMatrix, [...stack, id]);
      }
    };

    const build = (asArray(model.build as XmlNode | XmlNode[] | undefined)[0] ?? null) as XmlNode | null;
    const items = asArray(build?.item as XmlNode | XmlNode[] | undefined);
    if (items.length > 0) {
      for (const item of items) {
        if (item.objectid === undefined) continue;
        addObject(String(item.objectid), parseTransform(item.transform), []);
      }
    } else {
      for (const object of objects) {
        if (object.id !== undefined) addObject(String(object.id), IDENTITY, []);
      }
    }
  }

  return acc.result();
}

/** Parst STL, OBJ oder 3MF und liefert Volumen, Oberfläche und Maße in metrischen Einheiten. */
export function parseMesh(buffer: Buffer, filename: string): ParsedMesh {
  const format = detectMeshFormat(buffer, filename);
  if (!format) {
    throw new MeshError('Unbekanntes Dateiformat. Bitte laden Sie eine STL-, 3MF- oder OBJ-Datei hoch.', 'format');
  }

  const metrics = format === 'stl' ? parseStl(buffer) : format === 'obj' ? parseObj(buffer) : parse3mf(buffer);
  return { format, metrics };
}
