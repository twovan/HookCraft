-- 008_multi_version_generation.sql
-- Migration: Multi-Version Generation + Selection
-- Creates tables and schema changes for batch generation, download tracking, and producer profiles

-- ============================================================
-- 1. Extend task_status enum with new values
-- ============================================================
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'selected';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'archived';

-- ============================================================
-- 2. Create generation_batches table
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_batches (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id),
  prompt TEXT,
  generation_type generation_type NOT NULL,
  use_premium_singer BOOLEAN NOT NULL DEFAULT false,
  version_count INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'generating',
  selected_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_batches_user_id
  ON generation_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_batches_user_status
  ON generation_batches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_generation_batches_created_at
  ON generation_batches(created_at DESC);

-- ============================================================
-- 3. Create download_counts table
-- ============================================================
CREATE TABLE IF NOT EXISTS download_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT download_counts_user_period_unique
    UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_download_counts_user_id
  ON download_counts(user_id);

-- ============================================================
-- 4. Create producers table
-- ============================================================
CREATE TABLE IF NOT EXISTS producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  style_tags TEXT[] NOT NULL DEFAULT '{}',
  total_downloads INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producers_status
  ON producers(status);
CREATE INDEX IF NOT EXISTS idx_producers_featured
  ON producers(is_featured) WHERE is_featured = true;

-- ============================================================
-- 5. ALTER generation_tasks: add batch_id, version_number, duration_seconds
-- ============================================================
ALTER TABLE generation_tasks
  ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES generation_batches(id);

ALTER TABLE generation_tasks
  ADD COLUMN IF NOT EXISTS version_number INTEGER;

ALTER TABLE generation_tasks
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_generation_tasks_batch_id
  ON generation_tasks(batch_id);

-- ============================================================
-- 6. ALTER templates: add genre_tags column and producer_id index
-- ============================================================
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS genre_tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_templates_producer_id
  ON templates(producer_id) WHERE producer_id IS NOT NULL;

-- ============================================================
-- 7. RLS Policies
-- ============================================================

-- generation_batches: users can only see their own batches, server-side writes
ALTER TABLE generation_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的批次" ON generation_batches;
CREATE POLICY "用户可读取自己的批次" ON generation_batches
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入批次" ON generation_batches;
CREATE POLICY "仅服务端可插入批次" ON generation_batches
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新批次" ON generation_batches;
CREATE POLICY "仅服务端可更新批次" ON generation_batches
  FOR UPDATE USING (false);

-- download_counts: users can only see their own download counts, server-side writes
ALTER TABLE download_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的下载次数" ON download_counts;
CREATE POLICY "用户可读取自己的下载次数" ON download_counts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入下载次数" ON download_counts;
CREATE POLICY "仅服务端可插入下载次数" ON download_counts
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新下载次数" ON download_counts;
CREATE POLICY "仅服务端可更新下载次数" ON download_counts
  FOR UPDATE USING (false);

-- producers: publicly readable, server-side writes
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "所有人可读取制作人信息" ON producers;
CREATE POLICY "所有人可读取制作人信息" ON producers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "仅服务端可插入制作人" ON producers;
CREATE POLICY "仅服务端可插入制作人" ON producers
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新制作人" ON producers;
CREATE POLICY "仅服务端可更新制作人" ON producers
  FOR UPDATE USING (false);


-- ============================================================
-- 8. Create generations storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', false)
ON CONFLICT (id) DO NOTHING;
