-- ============================================================
-- 敏感词拦截与智能提示词改写 - 数据库迁移脚本
-- 创建 sensitive_words 表和 sensitivity_logs 表
-- ============================================================

-- 启用 uuid 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- sensitive_words 表（敏感词库）
-- ============================================================
CREATE TABLE IF NOT EXISTS sensitive_words (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  word text NOT NULL,
  category text NOT NULL CHECK (category IN ('celebrity', 'song_name', 'forbidden')),
  variants text[] DEFAULT '{}',
  note text DEFAULT '',
  hit_count integer DEFAULT 0,
  last_hit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- sensitive_words 索引
CREATE INDEX IF NOT EXISTS idx_sensitive_words_word ON sensitive_words (word);
CREATE INDEX IF NOT EXISTS idx_sensitive_words_category ON sensitive_words (category);
CREATE INDEX IF NOT EXISTS idx_sensitive_words_created_at ON sensitive_words (created_at);

-- word + category 唯一约束，防止同分类下重复词条
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensitive_words_word_category ON sensitive_words (word, category);

-- ============================================================
-- sensitivity_logs 表（检测日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS sensitivity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid,
  input_description text NOT NULL,
  input_lyrics text,
  result_type text NOT NULL CHECK (result_type IN ('pass', 'rewrite', 'block')),
  detected_words jsonb DEFAULT '[]',
  rewritten_prompt text,
  style_tags text[] DEFAULT '{}',
  user_confirmed boolean,
  detection_source text CHECK (detection_source IN ('local', 'gemini', 'both')),
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- sensitivity_logs 索引
CREATE INDEX IF NOT EXISTS idx_sensitivity_logs_created_at ON sensitivity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensitivity_logs_user_id ON sensitivity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_sensitivity_logs_result_type ON sensitivity_logs (result_type);

-- ============================================================
-- 自动更新 updated_at 触发器（sensitive_words 表）
-- ============================================================
CREATE OR REPLACE FUNCTION update_sensitive_words_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sensitive_words_updated_at
  BEFORE UPDATE ON sensitive_words
  FOR EACH ROW
  EXECUTE FUNCTION update_sensitive_words_updated_at();

-- ============================================================
-- Row Level Security (RLS) 策略
-- ============================================================

-- 启用 RLS
ALTER TABLE sensitive_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitivity_logs ENABLE ROW LEVEL SECURITY;

-- sensitive_words: 允许 service_role 完全访问（后端服务使用）
CREATE POLICY "Service role full access on sensitive_words"
  ON sensitive_words
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sensitive_words: 允许认证用户读取（前端本地匹配可能需要）
CREATE POLICY "Authenticated users can read sensitive_words"
  ON sensitive_words
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- sensitivity_logs: 允许 service_role 完全访问
CREATE POLICY "Service role full access on sensitivity_logs"
  ON sensitivity_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- sensitivity_logs: 用户只能查看自己的日志
CREATE POLICY "Users can view own sensitivity_logs"
  ON sensitivity_logs
  FOR SELECT
  USING (auth.uid() = user_id);
