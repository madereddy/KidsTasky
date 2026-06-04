-- Indexes to support daily cleanup queries in background worker
CREATE INDEX IF NOT EXISTS idx_sent_reminders_sentAt ON sent_reminders(sentAt);
CREATE INDEX IF NOT EXISTS idx_notifications_status_createdAt ON notifications(status, createdAt);

UPDATE schema_version SET version = 47;
