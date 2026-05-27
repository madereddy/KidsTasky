CREATE INDEX IF NOT EXISTS idx_completions_task_date ON completions(taskId, dateString);
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned ON tasks(status, assignedKidId);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_status ON tasks(parentId, status);
CREATE INDEX IF NOT EXISTS idx_sync_calendars_connection_enabled ON sync_calendars(connectionId, enabled);

UPDATE schema_version SET version = 35;
