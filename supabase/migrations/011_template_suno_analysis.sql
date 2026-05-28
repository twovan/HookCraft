-- Store SUNO-specific template analysis without changing existing Lyria3 fields.
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS suno_analysis_result TEXT,
  ADD COLUMN IF NOT EXISTS suno_prompt TEXT,
  ADD COLUMN IF NOT EXISTS suno_analyzed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suno_analysis_status analysis_status NOT NULL DEFAULT 'pending';
