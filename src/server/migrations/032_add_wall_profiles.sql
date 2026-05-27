CREATE TABLE IF NOT EXISTS calendar_visibility (
  userId TEXT NOT NULL,
  calendarId TEXT NOT NULL,
  isVisible INTEGER DEFAULT 1,
  PRIMARY KEY (userId, calendarId),
  FOREIGN KEY (userId) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
  userId TEXT PRIMARY KEY,
  defaultWallProfile TEXT DEFAULT 'family',
  wallAutoRefresh INTEGER DEFAULT 1,
  FOREIGN KEY (userId) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_visibility_id ON calendar_visibility(calendarId);
