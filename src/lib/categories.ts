import { getDb } from '../db/index.js';

/**
 * Produktkategorien.
 *
 * Kategorien werden im Admin gepflegt und Produkten zugeordnet. Ein Produkt
 * kann mehreren Kategorien angehören (z. B. „Küche“ und „Saisonales“).
 */
export type Category = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
};

type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
};

function toCategory(row: CategoryRow): Category {
  return { id: row.id, slug: row.slug, name: row.name, sortOrder: row.sort_order };
}

export function slugifyCategory(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function allCategories(): Category[] {
  const rows = getDb()
    .prepare('SELECT id, slug, name, sort_order FROM product_categories ORDER BY sort_order, name')
    .all() as CategoryRow[];
  return rows.map(toCategory);
}

export function findCategory(id: number): Category | undefined {
  const row = getDb()
    .prepare('SELECT id, slug, name, sort_order FROM product_categories WHERE id = ?')
    .get(id) as CategoryRow | undefined;
  return row ? toCategory(row) : undefined;
}

export function findCategoryBySlug(slug: string): Category | undefined {
  const row = getDb()
    .prepare('SELECT id, slug, name, sort_order FROM product_categories WHERE slug = ?')
    .get(slug) as CategoryRow | undefined;
  return row ? toCategory(row) : undefined;
}

export function categoriesForProduct(productId: number): Category[] {
  const rows = getDb()
    .prepare(
      `SELECT c.id, c.slug, c.name, c.sort_order
       FROM product_categories c
       JOIN product_category_links l ON l.category_id = c.id
       WHERE l.product_id = ?
       ORDER BY c.sort_order, c.name`,
    )
    .all(productId) as CategoryRow[];
  return rows.map(toCategory);
}

export function categoryIdsForProduct(productId: number): number[] {
  const rows = getDb()
    .prepare('SELECT category_id FROM product_category_links WHERE product_id = ?')
    .all(productId) as { category_id: number }[];
  return rows.map((row) => row.category_id);
}

export function saveProductCategories(productId: number, categoryIds: number[]): void {
  const unique = [...new Set(categoryIds.filter((id) => Number.isInteger(id) && id > 0))];
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM product_category_links WHERE product_id = ?').run(productId);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO product_category_links (product_id, category_id) VALUES (?, ?)',
    );
    for (const categoryId of unique) {
      const exists = db.prepare('SELECT 1 FROM product_categories WHERE id = ?').get(categoryId);
      if (exists) insert.run(productId, categoryId);
    }
  });
  transaction();
}

/** Legt eine Kategorie an; der Slug wird aus dem Namen erzeugt und ist eindeutig. */
export function createCategory(name: string, sortOrder = 0): { category?: Category; error?: string } {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: 'Bitte einen Namen angeben.' };
  const root = slugifyCategory(clean) || 'kategorie';
  let slug = root;
  let counter = 2;
  const db = getDb();
  while (db.prepare('SELECT 1 FROM product_categories WHERE slug = ?').get(slug)) {
    slug = `${root.slice(0, 70)}-${counter}`;
    counter += 1;
  }
  const info = db
    .prepare('INSERT INTO product_categories (slug, name, sort_order) VALUES (?, ?, ?)')
    .run(slug, clean, Math.trunc(sortOrder) || 0);
  return { category: findCategory(Number(info.lastInsertRowid)) };
}

export function updateCategory(id: number, name: string, sortOrder: number): { error?: string } {
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: 'Bitte einen Namen angeben.' };
  const result = getDb()
    .prepare('UPDATE product_categories SET name = ?, sort_order = ? WHERE id = ?')
    .run(clean, Math.trunc(sortOrder) || 0, id);
  return result.changes > 0 ? {} : { error: 'Diese Kategorie wurde nicht gefunden.' };
}

export function deleteCategory(id: number): { error?: string } {
  const result = getDb().prepare('DELETE FROM product_categories WHERE id = ?').run(id);
  return result.changes > 0 ? {} : { error: 'Diese Kategorie wurde nicht gefunden.' };
}
