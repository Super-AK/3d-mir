-- Produktvideos (zusätzlich zu den Bildern), served unter /media/videos/.
CREATE TABLE IF NOT EXISTS product_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_videos_product ON product_videos(product_id, sort_order);
