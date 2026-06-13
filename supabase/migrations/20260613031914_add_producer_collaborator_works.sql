ALTER TABLE producers
  ADD COLUMN IF NOT EXISTS collaborator_works JSONB NOT NULL DEFAULT '[]'::jsonb;
