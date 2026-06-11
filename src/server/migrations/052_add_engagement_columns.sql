ALTER TABLE users ADD COLUMN longestStreak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN lastMissionDate TEXT;
ALTER TABLE users ADD COLUMN powerMissionId TEXT;
ALTER TABLE users ADD COLUMN powerMissionDate TEXT;

CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  xp INTEGER NOT NULL,
  reason TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_xp_events_parentId_createdAt ON xp_events(parentId, createdAt);

UPDATE schema_version SET version = 52;
