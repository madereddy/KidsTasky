ALTER TABLE sync_connections ADD COLUMN lastSyncAt INTEGER;
ALTER TABLE sync_connections ADD COLUMN lastSyncStatus TEXT;

UPDATE schema_version SET version = 22;
