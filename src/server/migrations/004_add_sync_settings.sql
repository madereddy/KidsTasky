-- src/server/migrations/004_add_sync_settings.sql
CREATE TABLE IF NOT EXISTS family_settings (
  parentId TEXT PRIMARY KEY,
  locationLat REAL,
  locationLon REAL,
  timezone TEXT
);

CREATE TABLE IF NOT EXISTS sync_connections (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  provider TEXT,
  accessToken TEXT,
  refreshToken TEXT
);

-- We also need to add externalId to events to support deduplication
ALTER TABLE events ADD COLUMN externalId TEXT;
ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'local';

UPDATE schema_version SET version = 4;
