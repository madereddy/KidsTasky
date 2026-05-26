CREATE TABLE IF NOT EXISTS sync_calendars (
  id TEXT PRIMARY KEY,
  connectionId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  calendarId TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (connectionId) REFERENCES sync_connections(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_calendars_unique ON sync_calendars(connectionId, calendarId);
CREATE INDEX IF NOT EXISTS idx_sync_calendars_parent ON sync_calendars(parentId);
