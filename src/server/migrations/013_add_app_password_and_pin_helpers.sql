-- 013_add_app_password_and_pin_helpers.sql
ALTER TABLE sync_connections ADD COLUMN appPassword TEXT;
ALTER TABLE sync_connections ADD COLUMN email TEXT;
ALTER TABLE sync_connections ADD COLUMN icalUrl TEXT;

-- We'll use passwordHash for kids' PINs, which already exists.
-- But let's add a flag to know if a user is managed (no email needed).
ALTER TABLE users ADD COLUMN isManaged BOOLEAN DEFAULT 0;

UPDATE schema_version SET version = 13;
