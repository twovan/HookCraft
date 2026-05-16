-- Migration: Producer Earnings Table
-- Records revenue sharing for each template sale

CREATE TABLE IF NOT EXISTS producer_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL,
  template_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  sale_amount INTEGER NOT NULL DEFAULT 0,        -- 销售金额（分）
  producer_share INTEGER NOT NULL DEFAULT 0,     -- 制作人分成（分）
  platform_share INTEGER NOT NULL DEFAULT 0,     -- 平台分成（分）
  share_ratio NUMERIC(5,4) NOT NULL DEFAULT 0.7000, -- 制作人分成比例
  status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'paid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producer_earnings_producer ON producer_earnings(producer_id);
CREATE INDEX IF NOT EXISTS idx_producer_earnings_order ON producer_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_producer_earnings_status ON producer_earnings(status);
