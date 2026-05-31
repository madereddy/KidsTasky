ALTER TABLE family_settings ADD COLUMN screensaverShuffle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_settings ADD COLUMN screensaverDurationSec INTEGER NOT NULL DEFAULT 10;
ALTER TABLE family_settings ADD COLUMN screensaverCaptions INTEGER NOT NULL DEFAULT 1;
