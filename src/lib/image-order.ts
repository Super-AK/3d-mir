/**
 * Eindeutige Sortierung der Produktbilder.
 *
 * Wie bei den Produkten werden die Nummern nach jeder Änderung auf 1..n
 * normalisiert. Alle Funktionen sind auf ein Produkt begrenzt, damit die
 * Reihenfolge anderer Produkte unberührt bleibt.
 */

import { getDb } from '../db/index.js';
import { moveId, placeId, type SortDirection } from './product-order.js';

type SortRow = { id: number; sort_order: number };

function orderedRows(productId: number): SortRow[] {
  return getDb()
    .prepare('SELECT id, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id')
    .all(productId) as SortRow[];
}

function saveOrder(productId: number, ids: number[]): void {
  const db = getDb();
  db.transaction(() => {
    const update = db.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?');
    ids.forEach((id, index) => update.run(index + 1, id, productId));
  })();
}

/** Verschiebt ein Bild um eine Position. */
export function moveImage(productId: number, id: number, direction: SortDirection): boolean {
  const ids = orderedRows(productId).map((row) => row.id);
  const next = moveId(ids, id, direction);
  if (next === ids) return false;
  saveOrder(productId, next);
  return true;
}

/** Übernimmt eine komplette Reihenfolge (Drag & Drop). */
export function applyImageOrder(productId: number, ids: number[]): boolean {
  const current = orderedRows(productId).map((row) => row.id);
  const unique = [...new Set(ids)];
  if (ids.length !== current.length || unique.length !== ids.length) return false;
  if (unique.some((id) => !current.includes(id))) return false;
  if (ids.every((id, index) => id === current[index])) return false;
  saveOrder(productId, unique);
  return true;
}

/** Setzt ein Bild auf die gewünschte Nummer; die übrigen rücken auf. */
export function assignImageSortOrder(productId: number, id: number, target: number): boolean {
  const rows = orderedRows(productId);
  if (!rows.some((row) => row.id === id) || !Number.isFinite(target)) return false;
  const rank = rows.filter((row) => row.id !== id && row.sort_order < target).length;
  const ids = placeId(
    rows.map((row) => row.id),
    id,
    rank,
  );
  saveOrder(productId, ids);
  return true;
}

/** Normalisiert vorhandene Nummern, ohne die Reihenfolge zu ändern. */
export function normalizeImageOrder(productId: number): void {
  saveOrder(productId, orderedRows(productId).map((row) => row.id));
}
