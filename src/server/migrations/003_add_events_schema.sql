-- src/server/migrations/003_add_events_schema.sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT,
  description TEXT,
  startTime INTEGER,
  endTime INTEGER,
  assignedToId TEXT,
  color TEXT
);

UPDATE schema_version SET version = 3;
