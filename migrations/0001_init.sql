CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subtype TEXT,
  title TEXT,
  notes TEXT,
  fields TEXT NOT NULL DEFAULT '{}',
  intro_short TEXT,
  intro_long TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  ai_uncertain TEXT NOT NULL DEFAULT '[]',
  published TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at DESC);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  item_ids TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
