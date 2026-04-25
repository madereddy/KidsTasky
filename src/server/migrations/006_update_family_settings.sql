-- src/server/migrations/006_update_family_settings.sql
ALTER TABLE family_settings ADD COLUMN pin TEXT DEFAULT NULL;
ALTER TABLE family_settings ADD COLUMN sleepStart TEXT DEFAULT '22:00';
ALTER TABLE family_settings ADD COLUMN sleepEnd TEXT DEFAULT '06:00';

UPDATE schema_version SET version = 6;
