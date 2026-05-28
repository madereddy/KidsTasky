CREATE INDEX IF NOT EXISTS idx_events_reminder_start_parent
  ON events(reminderMinutes, startTime, parentId);

CREATE INDEX IF NOT EXISTS idx_tasks_status_reminder
  ON tasks(status, reminderTime);

UPDATE schema_version SET version = 39;
