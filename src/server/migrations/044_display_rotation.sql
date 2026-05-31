ALTER TABLE family_settings ADD COLUMN displayRotationEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_settings ADD COLUMN displayRotationInterval INTEGER NOT NULL DEFAULT 30;
ALTER TABLE family_settings ADD COLUMN displayRotationOrder TEXT NOT NULL DEFAULT '["chores","calendar","weather","photos"]';
