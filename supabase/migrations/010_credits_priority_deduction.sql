-- ============================================================
-- Credits 优先扣除机制 - 新增表
-- ============================================================

-- ============================================================
-- purchased_credits 表：存储用户购买 Credits 余额
-- ============================================================
CREATE TABLE IF NOT EXISTS purchased_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT purchased_credits_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_purchased_credits_user_id ON purchased_credits(user_id);

-- ============================================================
-- credit_transactions 表：记录每次 Credits 变动的拆分明细
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  total_cost INTEGER NOT NULL,
  monthly_cost INTEGER NOT NULL DEFAULT 0,
  purchased_cost INTEGER NOT NULL DEFAULT 0,
  monthly_remaining_after INTEGER NOT NULL,
  purchased_remaining_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_cost_check CHECK (total_cost = monthly_cost + purchased_cost)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON credit_transactions(user_id, created_at DESC);

-- ============================================================
-- 扩展 credit_history 表：添加分类使用字段
-- ============================================================

ALTER TABLE credit_history
  ADD COLUMN IF NOT EXISTS monthly_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE credit_history
  ADD COLUMN IF NOT EXISTS purchased_used INTEGER NOT NULL DEFAULT 0;

-- 等式约束：used = monthly_used + purchased_used
-- 使用 DO $$ 块检查约束是否已存在，确保幂等性
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_history_usage_check'
  ) THEN
    ALTER TABLE credit_history
      ADD CONSTRAINT credit_history_usage_check
      CHECK (used = monthly_used + purchased_used);
  END IF;
END
$$;

-- ============================================================
-- consume_credits_with_priority 函数：原子性优先扣除逻辑
-- ============================================================

CREATE OR REPLACE FUNCTION consume_credits_with_priority(
  p_user_id UUID,
  p_total_cost INTEGER,
  p_operation_type TEXT,
  p_credits_version INTEGER,
  p_purchased_version INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_monthly_remaining INTEGER;
  v_purchased_balance INTEGER;
  v_monthly_cost INTEGER;
  v_purchased_cost INTEGER;
  v_credits_updated INTEGER;
  v_purchased_updated INTEGER;
BEGIN
  -- 1. 读取月度剩余 (total - used) 并验证乐观锁版本
  SELECT total - used INTO v_monthly_remaining
  FROM credits WHERE user_id = p_user_id AND version = p_credits_version;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrent_limit');
  END IF;

  -- 2. 获取购买 Credits 余额（无记录时为 0）
  SELECT COALESCE(balance, 0) INTO v_purchased_balance
  FROM purchased_credits WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    v_purchased_balance := 0;
  END IF;

  -- 3. 检查总池是否充足
  IF v_monthly_remaining + v_purchased_balance < p_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits');
  END IF;

  -- 4. 计算拆分：优先从月度 Credits 扣除
  IF v_monthly_remaining >= p_total_cost THEN
    v_monthly_cost := p_total_cost;
    v_purchased_cost := 0;
  ELSE
    v_monthly_cost := v_monthly_remaining;
    v_purchased_cost := p_total_cost - v_monthly_remaining;
  END IF;

  -- 5. 乐观锁更新 credits 表
  UPDATE credits SET
    used = used + v_monthly_cost,
    version = version + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND version = p_credits_version;

  GET DIAGNOSTICS v_credits_updated = ROW_COUNT;
  IF v_credits_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrent_limit');
  END IF;

  -- 6. 如需从购买 Credits 扣除，乐观锁更新 purchased_credits 表
  IF v_purchased_cost > 0 THEN
    UPDATE purchased_credits SET
      balance = balance - v_purchased_cost,
      version = version + 1,
      updated_at = now()
    WHERE user_id = p_user_id AND version = p_purchased_version;

    GET DIAGNOSTICS v_purchased_updated = ROW_COUNT;
    IF v_purchased_updated = 0 THEN
      RAISE EXCEPTION 'concurrent_limit';
    END IF;
  END IF;

  -- 7. 写入交易记录
  INSERT INTO credit_transactions (
    user_id, operation_type, total_cost, monthly_cost, purchased_cost,
    monthly_remaining_after, purchased_remaining_after
  ) VALUES (
    p_user_id, p_operation_type, p_total_cost, v_monthly_cost, v_purchased_cost,
    v_monthly_remaining - v_monthly_cost, v_purchased_balance - v_purchased_cost
  );

  -- 8. 返回成功结果
  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_total_cost,
    'monthly_cost', v_monthly_cost,
    'purchased_cost', v_purchased_cost,
    'monthly_remaining', v_monthly_remaining - v_monthly_cost,
    'purchased_remaining', v_purchased_balance - v_purchased_cost
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrent_limit');
END;
$$ LANGUAGE plpgsql;
