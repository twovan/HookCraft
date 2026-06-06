-- Ensure credit_history supports split monthly/purchased usage.
-- Some deployed databases were created before migration 010 was applied.

ALTER TABLE credit_history
  ADD COLUMN IF NOT EXISTS monthly_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE credit_history
  ADD COLUMN IF NOT EXISTS purchased_used INTEGER NOT NULL DEFAULT 0;

UPDATE credit_history
SET monthly_used = used,
    purchased_used = 0
WHERE used > 0
  AND monthly_used = 0
  AND purchased_used = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'credit_history_usage_check'
  ) THEN
    ALTER TABLE credit_history
      ADD CONSTRAINT credit_history_usage_check
      CHECK (used = monthly_used + purchased_used);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
