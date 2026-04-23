CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  role TEXT,
  name TEXT,
  email TEXT,
  parentId TEXT,
  xp INTEGER,
  level INTEGER,
  badges TEXT,
  themeId TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  frequency TEXT,
  reminderTime TEXT,
  assignedKidId TEXT,
  parentId TEXT,
  categoryId TEXT,
  difficulty TEXT,
  status TEXT,
  createdAt INTEGER,
  customInterval INTEGER,
  prerequisiteTaskIds TEXT
);

CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY,
  taskId TEXT,
  kidId TEXT,
  completedAt INTEGER,
  dateString TEXT,
  count INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  icon TEXT,
  color TEXT,
  parentId TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  parentName TEXT,
  createdAt INTEGER,
  status TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  kidId TEXT,
  taskId TEXT,
  taskTitle TEXT,
  kidName TEXT,
  type TEXT,
  status TEXT,
  createdAt INTEGER,
  dateString TEXT
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  parentId TEXT,
  title TEXT,
  description TEXT,
  xpCost INTEGER
);

CREATE TABLE IF NOT EXISTS claimedRewards (
  id TEXT PRIMARY KEY,
  kidId TEXT,
  rewardId TEXT,
  createdAt INTEGER
);

UPDATE schema_version SET version = 1;
