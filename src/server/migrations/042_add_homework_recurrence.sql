ALTER TABLE homework ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_homework_parent_recurrence_due
  ON homework(parentId, recurrence, dueDate);
