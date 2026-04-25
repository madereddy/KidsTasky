-- src/server/migrations/009_add_streaks.sql
ALTER TABLE users ADD COLUMN currentStreak INTEGER DEFAULT 0;

UPDATE schema_version SET version = 9;
