CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  parentId TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  dueDate TEXT NOT NULL,
  assignedToId TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  color TEXT NOT NULL DEFAULT '#6366f1',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_homework_parent ON homework(parentId);
CREATE INDEX IF NOT EXISTS idx_homework_due ON homework(dueDate);
