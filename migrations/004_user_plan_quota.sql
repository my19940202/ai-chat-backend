-- Migration 004: 用户套餐与用量计数
ALTER TABLE users ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN daily_standard_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN monthly_standard_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN monthly_premium_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_daily_reset_at INTEGER;
ALTER TABLE users ADD COLUMN last_monthly_reset_at INTEGER;
ALTER TABLE users ADD COLUMN credit INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS usage_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  quota_type TEXT NOT NULL CHECK (quota_type IN ('standard', 'premium')),
  plan_tier TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'chat',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_history_user_created
  ON usage_history(user_id, created_at DESC);
