CREATE TABLE IF NOT EXISTS auth_lockouts (
  targetId TEXT PRIMARY KEY, -- Can be parentId (for settings unlock) or userUid (for kid login)
  failedAttempts INTEGER DEFAULT 0,
  lockedUntil INTEGER, -- Timestamp in ms
  lastAttemptAt INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_lockouts_expiry ON auth_lockouts(lockedUntil);

UPDATE schema_version SET version = 50;
