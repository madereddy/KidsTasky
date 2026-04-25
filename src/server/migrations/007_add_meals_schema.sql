-- src/server/migrations/007_add_meals_schema.sql
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  name TEXT,
  ingredients TEXT
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  date TEXT,
  mealType TEXT,
  recipeId TEXT
);

UPDATE schema_version SET version = 7;
