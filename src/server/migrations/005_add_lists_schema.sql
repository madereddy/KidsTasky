-- src/server/migrations/005_add_lists_schema.sql
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS list_items (
  id TEXT PRIMARY KEY,
  listId TEXT,
  text TEXT,
  completed INTEGER DEFAULT 0
);

UPDATE schema_version SET version = 5;
