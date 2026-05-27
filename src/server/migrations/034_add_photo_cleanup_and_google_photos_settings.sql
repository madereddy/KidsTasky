ALTER TABLE family_settings ADD COLUMN photoCleanupEnabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE family_settings ADD COLUMN photoCleanupIntervalHours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE family_settings ADD COLUMN googlePhotosEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_settings ADD COLUMN googlePhotosAlbumId TEXT DEFAULT NULL;
