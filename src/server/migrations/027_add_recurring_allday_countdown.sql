ALTER TABLE events ADD COLUMN isAllDay INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN masterId TEXT;
ALTER TABLE events ADD COLUMN recurrence TEXT DEFAULT 'none';
ALTER TABLE events ADD COLUMN recurrenceEnd TEXT;
ALTER TABLE events ADD COLUMN isCountdown INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN reminderMinutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_events_parent_start ON events(parentId, startTime);

UPDATE schema_version SET version = 27;
