-- Composite index for homework windowed query (parentId = ? AND dueDate >= ? AND dueDate <= ?)
-- Existing idx_homework_parent_recurrence_due has recurrence in middle, blocking range scan on dueDate
CREATE INDEX IF NOT EXISTS idx_homework_parent_due ON homework(parentId, dueDate);

UPDATE schema_version SET version = 48;
