/**
 * Eindeutige Sortierung der Produkte.
 *
 * Die Sortiernummern werden nach jeder Änderung auf 1..n normalisiert. Damit
 * gibt es keine doppelten Nummern mehr, und Admin, Shop und Sitemap verwenden
 * dieselbe Reihenfolge.
 */

import { getDb } from '../db/index.js';

export type SortDirection = 'up' | 'down';

type SortRow = { id: number; sort_order: number };

/** Tauscht einen Eintrag mit seinem Nachbarn. Reine Hilfsfunktion für Tests. */
export function moveId(ids: number[], id: number, direction: SortDirection): number[] {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Setzt einen Eintrag an eine Position und lässt die anderen aufrücken. */
export function placeId(ids: number[], id: number, rank: number): number[] {
  if (!ids.includes(id)) return ids;
  const next = ids.filter((entry) => entry !== id);
  const index = Math.max(0, Math.min(Math.trunc(rank), next.length));
  next.splice(index, 0, id);
  return next;
}

function orderedRows(): SortRow[] {
  return getDb()
    .prepare('SELECT id, sort_order FROM products ORDER BY sort_order, id')
    .all() as SortRow[];
}

function saveOrder(ids: number[]): void {
  const db = getDb();
  db.transaction(() => {
    const update = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?');
    ids.forEach((id, index) => update.run(index + 1, id));
  })();
}

/** Verschiebt ein Produkt um eine Position. */
export function moveProduct(id: number, direction: SortDirection): boolean {
  const ids = orderedRows().map((row) => row.id);
  const next = moveId(ids, id, direction);
  if (next === ids) return false;
  saveOrder(next);
  return true;
}

/** Übernimmt eine komplette Reihenfolge (Drag & Drop). */
export function applyProductOrder(ids: number[]): boolean {
  const current = orderedRows().map((row) => row.id);
  const unique = [...new Set(ids)];
  if (ids.length !== current.length || unique.length !== ids.length) return false;
  if (unique.some((id) => !current.includes(id))) return false;
  if (ids.every((id, index) => id === current[index])) return false;
  saveOrder(unique);
  return true;
}

/**
 * Setzt ein Produkt auf die gewünschte Nummer. Produkte mit derselben oder
 * einer höheren Nummer rücken auf, die Nummern werden anschließend 1..n.
 */
export function assignProductSortOrder(id: number, target: number): boolean {
  const rows = orderedRows();
  if (!rows.some((row) => row.id === id) || !Number.isFinite(target)) return false;
  const rank = rows.filter((row) => row.id !== id && row.sort_order < target).length;
  const ids = placeId(
    rows.map((row) => row.id),
    id,
    rank,
  );
  saveOrder(ids);
  return true;
}

/** Normalisiert vorhandene Nummern, ohne die Reihenfolge zu ändern. */
export function normalizeProductOrder(): void {
  saveOrder(orderedRows().map((row) => row.id));
}
