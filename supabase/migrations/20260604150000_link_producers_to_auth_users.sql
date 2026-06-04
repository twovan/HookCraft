-- Keep producer identity separate from membership, but bind one producer profile
-- to at most one auth account when user_id is present.

UPDATE templates AS t
SET producer_id = p.id
FROM producers AS p
WHERE t.producer_id = p.user_id
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM producers AS duplicate
    WHERE duplicate.user_id = p.user_id
      AND duplicate.id <> p.id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM producers
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_producers_user_id_unique
      ON producers(user_id)
      WHERE user_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped idx_producers_user_id_unique because duplicate producer user_id values exist.';
  END IF;
END $$;
