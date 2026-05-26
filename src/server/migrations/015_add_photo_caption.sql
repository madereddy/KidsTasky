ALTER TABLE family_photos ADD COLUMN caption TEXT;

UPDATE schema_version SET version = 15;
