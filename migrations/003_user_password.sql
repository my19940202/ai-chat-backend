-- Migration 003: 用户密码字段（登录校验）
ALTER TABLE users ADD COLUMN password_hash TEXT;
