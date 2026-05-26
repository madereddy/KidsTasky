ALTER TABLE family_settings ADD COLUMN isLocked INTEGER NOT NULL DEFAULT 0;

UPDATE schema_version SET version = 16;
