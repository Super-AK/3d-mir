import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { MeshError, detectMeshFormat, parseMesh } from '../../src/lib/mesh.js';

const points = [
  [0, 0, 0],
  [10, 0, 0],
  [10, 10, 0],
  [0, 10, 0],
  [0, 0, 10],
  [10, 0, 10],
  [10, 10, 10],
  [0, 10, 10],
];
const faces = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 5, 6],
  [4, 6, 7],
  [0, 1, 5],
  [0, 5, 4],
  [1, 2, 6],
  [1, 6, 5],
  [2, 3, 7],
  [2, 7, 6],
  [3, 0, 4],
  [3, 4, 7],
];

function binaryStl(): Buffer {
  const buffer = Buffer.alloc(84 + faces.length * 50);
  buffer.write('Testwürfel', 0);
  buffer.writeUInt32LE(faces.length, 80);
  faces.forEach((face, index) => {
    const offset = 84 + index * 50 + 12;
    face.forEach((vertexIndex, vertex) => {
      const point = points[vertexIndex]!;
      buffer.writeFloatLE(point[0]!, offset + vertex * 12);
      buffer.writeFloatLE(point[1]!, offset + vertex * 12 + 4);
      buffer.writeFloatLE(point[2]!, offset + vertex * 12 + 8);
    });
  });
  return buffer;
}

function obj(): Buffer {
  return Buffer.from([
    '# Würfel',
    ...points.map((point) => `v ${point.join(' ')}`),
    ...faces.map((face) => `f ${face.map((index) => index + 1).join(' ')}`),
  ].join('\n'));
}

function threeMf(): Buffer {
  const vertices = points.map((point) => `<vertex x="${point[0]}" y="${point[1]}" z="${point[2]}"/>`).join('');
  const triangles = faces
    .map((face) => `<triangle v1="${face[0]}" v2="${face[1]}" v3="${face[2]}"/>`)
    .join('');
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object></resources>
  <build><item objectid="1"/></build>
</model>`;
  return Buffer.from(zipSync({ '3D/3dmodel.model': strToU8(model) }));
}

describe('parseMesh', () => {
  it.each([
    ['STL', binaryStl(), 'stl'],
    ['OBJ', obj(), 'obj'],
    ['3MF', threeMf(), '3mf'],
  ])('liest %s und berechnet Volumen, Oberfläche und Maße', (_label, buffer, format) => {
    const parsed = parseMesh(buffer as Buffer, `würfel.${format}`);
    expect(parsed.format).toBe(format);
    expect(parsed.metrics.volumeCm3).toBeCloseTo(1, 3);
    expect(parsed.metrics.surfaceCm2).toBeCloseTo(6, 3);
    expect(parsed.metrics.dimensionsMm).toEqual({ x: 10, y: 10, z: 10 });
    expect(parsed.metrics.triangles).toBe(12);
  });

  it('erkennt das Format am Inhalt statt nur an der Endung', () => {
    expect(detectMeshFormat(binaryStl(), 'modell.dat')).toBe('stl');
    expect(detectMeshFormat(obj(), 'modell.dat')).toBe('obj');
  });

  it('lehnt unbekannte Dateien ab', () => {
    expect(() => parseMesh(Buffer.from('kein 3d-modell'), 'datei.txt')).toThrow(MeshError);
  });
});
