ALTER TABLE users ADD COLUMN color TEXT DEFAULT '#6366f1';
CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plans_slot ON meal_plans (parentId, date, mealType);
