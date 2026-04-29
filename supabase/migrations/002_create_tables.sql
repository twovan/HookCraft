-- 002_create_tables.sql
-- 创建所有 12 张表：主键、外键、唯一约束、默认值和索引
-- 使用 CREATE TABLE IF NOT EXISTS 确保幂等性

-- ============================================================
-- memberships 表
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier membership_tier NOT NULL DEFAULT 'free',
  billing_cycle billing_cycle,
  start_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  payment_provider payment_provider,
  subscription_id TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  grace_period_end TIMESTAMPTZ,
  pending_downgrade_tier membership_tier,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);

-- ============================================================
-- credits 表
-- ============================================================
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier membership_tier NOT NULL DEFAULT 'free',
  used INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credits_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);

-- ============================================================
-- credit_history 表
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  used INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_history_user_id ON credit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_history_month ON credit_history(user_id, month);

-- ============================================================
-- preview_counts 表
-- ============================================================
CREATE TABLE IF NOT EXISTS preview_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT preview_counts_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_preview_counts_user_id ON preview_counts(user_id);

-- ============================================================
-- templates 表
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category template_category NOT NULL,
  genre TEXT NOT NULL,
  preview_url TEXT,
  cover_url TEXT,
  reference_audio_url TEXT,
  analysis_result TEXT,
  lyria_prompt TEXT,
  analyzed_at TIMESTAMPTZ,
  analysis_status analysis_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- generation_tasks 表
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_tasks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type generation_type NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  prompt TEXT,
  template_id TEXT REFERENCES templates(id),
  model_id TEXT NOT NULL,
  audio_path TEXT,
  raw_audio_path TEXT,
  lyrics TEXT,
  song_structure TEXT,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_id ON generation_tasks(user_id);

-- ============================================================
-- payment_sessions 表
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider payment_provider NOT NULL,
  checkout_url TEXT NOT NULL,
  tier membership_tier NOT NULL,
  billing_cycle billing_cycle NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_id ON payment_sessions(user_id);

-- ============================================================
-- payments 表
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES payment_sessions(id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  provider payment_provider NOT NULL,
  tier membership_tier NOT NULL,
  billing_cycle billing_cycle NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- ============================================================
-- processed_webhook_events 表
-- ============================================================
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  provider payment_provider NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- admin_config 表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type config_type NOT NULL,
  config_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_config_type_unique UNIQUE (config_type)
);

-- ============================================================
-- config_changelog 表
-- ============================================================
CREATE TABLE IF NOT EXISTS config_changelog (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  config_type config_type NOT NULL,
  previous_value JSONB NOT NULL,
  new_value JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_changelog_changed_at ON config_changelog(changed_at DESC);

-- ============================================================
-- downgraded_file_access 表
-- ============================================================
CREATE TABLE IF NOT EXISTS downgraded_file_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_tier membership_tier NOT NULL,
  export_format JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  grace_period_end TIMESTAMPTZ NOT NULL,
  access_status access_status NOT NULL DEFAULT 'accessible',
  CONSTRAINT downgraded_file_access_file_id_unique UNIQUE (file_id)
);

CREATE INDEX IF NOT EXISTS idx_downgraded_file_access_user_id ON downgraded_file_access(user_id);
