CREATE TABLE IF NOT EXISTS style_dna_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dna_jobs_user_id ON style_dna_jobs(user_id);

CREATE TABLE IF NOT EXISTS style_dna_source_tracks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dna_source_tracks_job_id ON style_dna_source_tracks(job_id);

CREATE TABLE IF NOT EXISTS track_analyses (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  source_track_id TEXT NOT NULL REFERENCES style_dna_source_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  duration NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0,
  bpm_estimate NUMERIC,
  bpm_range TEXT NOT NULL DEFAULT 'unknown',
  key_estimate TEXT NOT NULL DEFAULT 'unknown',
  mode TEXT NOT NULL DEFAULT 'unknown',
  genre_candidates TEXT[] NOT NULL DEFAULT '{}',
  mood_tags TEXT[] NOT NULL DEFAULT '{}',
  energy_curve JSONB NOT NULL DEFAULT '{}',
  section_map JSONB NOT NULL DEFAULT '[]',
  instrumentation JSONB NOT NULL DEFAULT '{}',
  drum_style JSONB NOT NULL DEFAULT '{}',
  bass_style JSONB NOT NULL DEFAULT '{}',
  harmony_style JSONB NOT NULL DEFAULT '{}',
  arrangement_density JSONB NOT NULL DEFAULT '{}',
  vocal_presence TEXT NOT NULL DEFAULT 'unknown',
  production_texture JSONB NOT NULL DEFAULT '{}',
  mix_traits TEXT[] NOT NULL DEFAULT '{}',
  signature_arrangement_moves TEXT[] NOT NULL DEFAULT '{}',
  avoid_elements TEXT[] NOT NULL DEFAULT '{}',
  raw_google_response JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_analyses_job_id ON track_analyses(job_id);

CREATE TABLE IF NOT EXISTS style_dnas (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_track_ids TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  genre TEXT[] NOT NULL DEFAULT '{}',
  tempo_range TEXT NOT NULL DEFAULT 'unknown',
  key_mood TEXT NOT NULL DEFAULT 'unknown',
  primary_instruments TEXT[] NOT NULL DEFAULT '{}',
  secondary_instruments TEXT[] NOT NULL DEFAULT '{}',
  drum_pattern TEXT NOT NULL DEFAULT 'unknown',
  bass_pattern TEXT NOT NULL DEFAULT 'unknown',
  harmony_language TEXT NOT NULL DEFAULT 'unknown',
  arrangement_formula JSONB NOT NULL DEFAULT '{}',
  section_structure JSONB NOT NULL DEFAULT '{}',
  production_texture TEXT NOT NULL DEFAULT 'unknown',
  emotional_arc TEXT NOT NULL DEFAULT '',
  chinese_pop_specific_traits TEXT[] NOT NULL DEFAULT '{}',
  suno_friendly_style_tags TEXT[] NOT NULL DEFAULT '{}',
  avoid_tags TEXT[] NOT NULL DEFAULT '{}',
  high_frequency_traits TEXT[] NOT NULL DEFAULT '{}',
  low_frequency_traits TEXT[] NOT NULL DEFAULT '{}',
  uncertain_traits TEXT[] NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dnas_job_id ON style_dnas(job_id);

CREATE TABLE IF NOT EXISTS suno_prompt_packages (
  id TEXT PRIMARY KEY,
  style_dna_id TEXT NOT NULL REFERENCES style_dnas(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  style_prompt_short TEXT NOT NULL,
  style_prompt_medium TEXT NOT NULL,
  style_prompt_long TEXT NOT NULL,
  style_prompt TEXT NOT NULL,
  lyric_prompt TEXT NOT NULL DEFAULT '',
  instrumental_prompt TEXT NOT NULL DEFAULT '',
  structure_prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  custom_mode BOOLEAN NOT NULL DEFAULT true,
  instrumental BOOLEAN NOT NULL DEFAULT false,
  provider_payload JSONB NOT NULL DEFAULT '{}',
  prompt_version INTEGER NOT NULL DEFAULT 1,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suno_prompt_packages_style_dna_id ON suno_prompt_packages(style_dna_id);

CREATE TABLE IF NOT EXISTS generation_feedback (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  prompt_package_id TEXT NOT NULL REFERENCES suno_prompt_packages(id) ON DELETE CASCADE,
  style_dna_id TEXT NOT NULL REFERENCES style_dnas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER,
  feedback_text TEXT,
  too_electronic BOOLEAN NOT NULL DEFAULT false,
  too_rock BOOLEAN NOT NULL DEFAULT false,
  too_generic BOOLEAN NOT NULL DEFAULT false,
  drums_too_heavy BOOLEAN NOT NULL DEFAULT false,
  chorus_not_big_enough BOOLEAN NOT NULL DEFAULT false,
  vocal_not_forward BOOLEAN NOT NULL DEFAULT false,
  not_mandarin_pop_enough BOOLEAN NOT NULL DEFAULT false,
  harmony_too_simple BOOLEAN NOT NULL DEFAULT false,
  arrangement_too_flat BOOLEAN NOT NULL DEFAULT false,
  emotion_not_progressive BOOLEAN NOT NULL DEFAULT false,
  melody_mismatch BOOLEAN NOT NULL DEFAULT false,
  arrangement_mismatch BOOLEAN NOT NULL DEFAULT false,
  vocal_mismatch BOOLEAN NOT NULL DEFAULT false,
  structure_mismatch BOOLEAN NOT NULL DEFAULT false,
  suggested_changes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_feedback_style_dna_id ON generation_feedback(style_dna_id);

CREATE TABLE IF NOT EXISTS style_dna_templates (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style_dna_id TEXT NOT NULL REFERENCES style_dnas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  style_dna_snapshot JSONB NOT NULL DEFAULT '{}',
  prompt_package_snapshot JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dna_templates_user_id ON style_dna_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_style_dna_templates_style_dna_id ON style_dna_templates(style_dna_id);

ALTER TABLE style_dna_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_dna_source_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_dnas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suno_prompt_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_dna_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own style dna jobs" ON style_dna_jobs;
CREATE POLICY "Users can read own style dna jobs" ON style_dna_jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert style dna jobs" ON style_dna_jobs;
CREATE POLICY "Server can insert style dna jobs" ON style_dna_jobs
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Server can update style dna jobs" ON style_dna_jobs;
CREATE POLICY "Server can update style dna jobs" ON style_dna_jobs
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users can read own style dna source tracks" ON style_dna_source_tracks;
CREATE POLICY "Users can read own style dna source tracks" ON style_dna_source_tracks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert style dna source tracks" ON style_dna_source_tracks;
CREATE POLICY "Server can insert style dna source tracks" ON style_dna_source_tracks
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Server can update style dna source tracks" ON style_dna_source_tracks;
CREATE POLICY "Server can update style dna source tracks" ON style_dna_source_tracks
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users can read own track analyses" ON track_analyses;
CREATE POLICY "Users can read own track analyses" ON track_analyses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert track analyses" ON track_analyses;
CREATE POLICY "Server can insert track analyses" ON track_analyses
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Users can read own style dnas" ON style_dnas;
CREATE POLICY "Users can read own style dnas" ON style_dnas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert style dnas" ON style_dnas;
CREATE POLICY "Server can insert style dnas" ON style_dnas
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Server can update style dnas" ON style_dnas;
CREATE POLICY "Server can update style dnas" ON style_dnas
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Users can read own suno prompt packages" ON suno_prompt_packages;
CREATE POLICY "Users can read own suno prompt packages" ON suno_prompt_packages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert suno prompt packages" ON suno_prompt_packages;
CREATE POLICY "Server can insert suno prompt packages" ON suno_prompt_packages
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Users can read own generation feedback" ON generation_feedback;
CREATE POLICY "Users can read own generation feedback" ON generation_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert generation feedback" ON generation_feedback;
CREATE POLICY "Server can insert generation feedback" ON generation_feedback
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Users can read own style dna templates" ON style_dna_templates;
CREATE POLICY "Users can read own style dna templates" ON style_dna_templates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Server can insert style dna templates" ON style_dna_templates;
CREATE POLICY "Server can insert style dna templates" ON style_dna_templates
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Server can update style dna templates" ON style_dna_templates;
CREATE POLICY "Server can update style dna templates" ON style_dna_templates
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Server can delete style dna templates" ON style_dna_templates;
CREATE POLICY "Server can delete style dna templates" ON style_dna_templates
  FOR DELETE USING (false);
