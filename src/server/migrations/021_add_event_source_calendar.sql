ALTER TABLE events ADD COLUMN sourceCalendarId TEXT;

CREATE INDEX IF NOT EXISTS idx_events_source_calendar ON events(parentId, source, sourceCalendarId);
