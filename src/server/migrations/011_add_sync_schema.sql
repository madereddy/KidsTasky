-- 011
ALTER TABLE sync_connections ADD COLUMN createdAt INTEGER DEFAULT (cast(strftime('%s','now') as int) * 1000);

UPDATE schema_version SET version = 11;

