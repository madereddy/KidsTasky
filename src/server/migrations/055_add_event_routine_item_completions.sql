CREATE TABLE IF NOT EXISTS event_routine_item_completions (
  eventId TEXT NOT NULL,
  listItemId TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  completedAt INTEGER,
  PRIMARY KEY (eventId, listItemId)
);

CREATE INDEX IF NOT EXISTS idx_event_routine_item_completions_event
  ON event_routine_item_completions(eventId);
