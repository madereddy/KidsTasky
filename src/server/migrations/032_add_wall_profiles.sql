CREATE TABLE IF NOT EXISTS calendar_visibility (
  userId TEXT NOT NULL,
  calendarId TEXT NOT NULL,
  isVisible INTEGER DEFAULT 1,
  PRIMARY KEY (userId, calendarId)
);

CREATE TABLE IF NOT EXISTS user_settings (
  userId TEXT PRIMARY KEY,
  defaultWallProfile TEXT DEFAULT 'family',
  wallAutoRefresh INTEGER DEFAULT 1
);
