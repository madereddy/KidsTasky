-- Fix rows that got the old hardcoded default 'America/Chicago'.
-- Rows that still have the Chicago default (never explicitly set by user)
-- are updated to Eastern time, which matches this family's location.
UPDATE family_settings
SET timezone = 'America/New_York'
WHERE timezone = 'America/Chicago';
