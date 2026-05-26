-- 024
CREATE TABLE IF NOT EXISTS routine_templates (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  defaultStartTime TEXT,
  defaultDuration INTEGER DEFAULT 3600000,
  assignedToId TEXT,
  color TEXT DEFAULT '#6366f1',
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routine_templates_parent ON routine_templates(parentId);
UPDATE schema_version SET version = 24;
