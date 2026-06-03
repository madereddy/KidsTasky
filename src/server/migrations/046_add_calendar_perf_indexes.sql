-- Add index for performance on events query
CREATE INDEX IF NOT EXISTS idx_events_parentId_startTime ON events(parentId, startTime);

-- Also add index for externalId lookups which are used in sync
CREATE INDEX IF NOT EXISTS idx_events_externalId_source ON events(externalId, source);

UPDATE schema_version SET version = 46;
