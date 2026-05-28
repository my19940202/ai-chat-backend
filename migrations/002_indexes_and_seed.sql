-- 额外索引与示例数据（可选）

-- 确保有 title 搜索索引（简单 LIKE 可用）
CREATE INDEX IF NOT EXISTS idx_conversations_title ON conversations(title);

-- 示例：可手动插入测试数据
-- INSERT INTO conversations (id, user_id, title, model, created_at, updated_at)
-- VALUES ('demo-1', 'demo-user', '示例对话', 'gpt-4o-mini', 1710000000000, 1710000000000);
