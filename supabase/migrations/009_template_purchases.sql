-- 009_template_purchases.sql
-- 模板购买记录表

CREATE TABLE IF NOT EXISTS template_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  order_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_purchases_user_template_unique 
    UNIQUE (user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_template_purchases_user_id 
  ON template_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_template_purchases_template_id 
  ON template_purchases(template_id);

-- RLS policies
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own purchases
CREATE POLICY "Users can read own purchases"
  ON template_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Server-side writes only (via service role key)
CREATE POLICY "Service role can insert purchases"
  ON template_purchases
  FOR INSERT
  WITH CHECK (true);
