CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  parentId TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sent_reminders (
  eventId TEXT NOT NULL,
  reminderMinutes INTEGER NOT NULL,
  sentAt INTEGER NOT NULL,
  PRIMARY KEY (eventId, reminderMinutes)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_userId ON push_subscriptions(userId);
CREATE INDEX IF NOT EXISTS idx_push_subs_parentId ON push_subscriptions(parentId);
