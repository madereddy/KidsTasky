-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_kid_id ON tasks(assignedKidId);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parentId);

-- Completions indexes
CREATE INDEX IF NOT EXISTS idx_completions_task_id ON completions(taskId);
CREATE INDEX IF NOT EXISTS idx_completions_kid_id ON completions(kidId);
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(dateString);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_parent_id ON notifications(parentId);
CREATE INDEX IF NOT EXISTS idx_notifications_kid_id ON notifications(kidId);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(taskId);

-- Rewards indexes
CREATE INDEX IF NOT EXISTS idx_rewards_parent_id ON rewards(parentId);

-- ClaimedRewards indexes
CREATE INDEX IF NOT EXISTS idx_claimedrewards_kid_id ON claimedRewards(kidId);
CREATE INDEX IF NOT EXISTS idx_claimedrewards_reward_id ON claimedRewards(rewardId);

-- Update Schema Version
UPDATE schema_version SET version = 2;
