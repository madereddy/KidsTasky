-- 023
ALTER TABLE sync_calendars ADD COLUMN color TEXT;
ALTER TABLE sync_calendars ADD COLUMN isSharedCalendar INTEGER DEFAULT 0;
UPDATE schema_version SET version = 23;
