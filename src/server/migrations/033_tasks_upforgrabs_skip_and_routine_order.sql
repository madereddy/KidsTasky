-- 033
ALTER TABLE routine_templates ADD COLUMN sortOrder INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS task_skips (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  kidId TEXT NOT NULL,
  dateString TEXT NOT NULL,
  count INTEGER,
  createdAt INTEGER NOT NULL,
  UNIQUE(taskId, kidId, dateString, count)
);

CREATE INDEX IF NOT EXISTS idx_task_skips_kid_date ON task_skips(kidId, dateString);
UPDATE schema_version SET version = 33;
