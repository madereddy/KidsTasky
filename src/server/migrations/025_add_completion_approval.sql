-- 025
ALTER TABLE completions ADD COLUMN approvalStatus TEXT;
ALTER TABLE tasks ADD COLUMN requiresApproval INTEGER DEFAULT 0;
UPDATE schema_version SET version = 25;
