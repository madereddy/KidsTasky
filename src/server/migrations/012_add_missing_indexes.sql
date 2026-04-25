-- Add missing indexes across the schema 
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parentId);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parentId);

CREATE INDEX IF NOT EXISTS idx_lists_parent_id ON lists(parentId);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(listId);

CREATE INDEX IF NOT EXISTS idx_recipes_parent_id ON recipes(parentId);

CREATE INDEX IF NOT EXISTS idx_meal_plans_parent_date ON meal_plans(parentId, date);

CREATE INDEX IF NOT EXISTS idx_events_parent_id ON events(parentId);
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(externalId);

CREATE INDEX IF NOT EXISTS idx_sync_connections_parent_id ON sync_connections(parentId);

CREATE INDEX IF NOT EXISTS idx_family_photos_parent_id ON family_photos(parentId);

CREATE INDEX IF NOT EXISTS idx_invites_parent_id ON invites(parentId);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);

-- Update the schema version
UPDATE schema_version SET version = 12;
