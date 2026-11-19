import { describe, expect, it } from 'vitest';
import { moveId, placeId } from '../../src/lib/product-order.js';

describe('Produkt-Sortierung', () => {
  it('tauscht einen Eintrag nur mit einem vorhandenen Nachbarn', () => {
    expect(moveId([1, 2, 3], 2, 'up')).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, 'down')).toEqual([1, 3, 2]);
    expect(moveId([1, 2, 3], 1, 'up')).toEqual([1, 2, 3]);
    expect(moveId([1, 2, 3], 3, 'down')).toEqual([1, 2, 3]);
    expect(moveId([1, 2, 3], 99, 'up')).toEqual([1, 2, 3]);
  });

  it('setzt einen Eintrag an eine Position und lässt die anderen aufrücken', () => {
    expect(placeId([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3]);
    expect(placeId([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4]);
    expect(placeId([1, 2, 3, 4], 2, 99)).toEqual([1, 3, 4, 2]);
    expect(placeId([1, 2, 3], 99, 0)).toEqual([1, 2, 3]);
  });

  it('entfernt einen Eintrag beim Verschieben nicht', () => {
    for (const [id, rank] of [[1, 0], [2, 1], [3, 2]] as const) {
      const result = placeId([1, 2, 3], id, rank);
      expect(result).toHaveLength(3);
      expect([...result].sort()).toEqual([1, 2, 3]);
    }
  });
});
