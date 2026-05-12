-- ============================================================
-- 007: Admin Accounts Table
-- 独立的管理员账户系统，与前端 Supabase Auth 完全分离
-- ============================================================

-- 创建 admin_accounts 表
CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 插入默认管理员账户
-- 密码: admin123 (bcrypt hash)
INSERT INTO admin_accounts (username, password_hash, display_name, role, is_active)
VALUES (
  'admin',
  '$2b$10$gHwsRgL72CgLkTj2jRzvZeYJQATkbQyK3Qyqs40U/MY5kIYnqqd9a',
  '超级管理员',
  'super_admin',
  true
)
ON CONFLICT (username) DO NOTHING;
