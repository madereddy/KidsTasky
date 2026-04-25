-- src/server/migrations/008_add_photos.sql
CREATE TABLE IF NOT EXISTS family_photos (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  url TEXT,
  uploadedAt TEXT
);

UPDATE schema_version SET version = 8;
