-- Composite index for per-kid daily completion queries
-- completions (actual table name) already has idx_completions_task_date (taskId, dateString)
-- Missing: kid+date composite for getCompletionsForKid queries
CREATE INDEX IF NOT EXISTS idx_completions_kid_date ON completions (kidId, dateString);

UPDATE schema_version SET version = 43;
