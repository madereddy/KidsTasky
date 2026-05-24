ALTER TABLE users       ADD COLUMN earnedStars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users       ADD COLUMN spentStars  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks       ADD COLUMN starValue   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rewards     ADD COLUMN starCost    INTEGER;
ALTER TABLE rewards     ADD COLUMN allowanceCents INTEGER;

CREATE TABLE IF NOT EXISTS allowance_ledger (
  id            TEXT PRIMARY KEY,
  kidId         TEXT NOT NULL,
  parentId      TEXT NOT NULL,
  rewardId      TEXT NOT NULL,
  rewardTitle   TEXT NOT NULL,
  amountCents   INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  claimedAt     TEXT NOT NULL,
  paidAt        TEXT,
  FOREIGN KEY (kidId) REFERENCES users(uid),
  FOREIGN KEY (rewardId) REFERENCES rewards(id)
);
