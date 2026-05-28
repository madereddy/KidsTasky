CREATE TABLE IF NOT EXISTS event_attendees (
  id TEXT PRIMARY KEY,
  eventId TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  userId TEXT NOT NULL,
  rsvp TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(eventId, userId)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(eventId);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(userId);
