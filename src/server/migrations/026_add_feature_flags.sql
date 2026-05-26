CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  flag TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updatedAt INTEGER NOT NULL,
  UNIQUE(parentId, flag)
);
CREATE INDEX IF NOT EXISTS idx_feature_flags_parent ON feature_flags(parentId);
UPDATE schema_version SET version = 26;
