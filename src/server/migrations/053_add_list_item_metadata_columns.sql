-- Migration 053: Add metadata columns to list_items to replace manual delimiters
ALTER TABLE list_items ADD COLUMN storeName TEXT;
ALTER TABLE list_items ADD COLUMN locationName TEXT;
ALTER TABLE list_items ADD COLUMN completedAt INTEGER;

UPDATE schema_version SET version = 53;
