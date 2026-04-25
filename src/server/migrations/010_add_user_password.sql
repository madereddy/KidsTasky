ALTER TABLE users ADD COLUMN passwordHash TEXT;
UPDATE schema_version SET version = 10;
