ALTER TABLE events ADD COLUMN routineListId TEXT;

CREATE INDEX IF NOT EXISTS idx_events_routine_list_id ON events(routineListId);
