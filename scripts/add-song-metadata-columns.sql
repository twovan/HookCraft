-- Add metadata columns to generation_tasks table
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS title text DEFAULT NULL;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS author_name text DEFAULT NULL;
ALTER TABLE generation_tasks ADD COLUMN IF NOT EXISTS style_tags text[] DEFAULT '{}';
