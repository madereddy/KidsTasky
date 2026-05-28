CREATE INDEX IF NOT EXISTS idx_sent_reminders_event_minutes ON sent_reminders(eventId, reminderMinutes);
CREATE INDEX IF NOT EXISTS idx_family_photos_parent_url ON family_photos(parentId, url);

UPDATE schema_version SET version = 38;
