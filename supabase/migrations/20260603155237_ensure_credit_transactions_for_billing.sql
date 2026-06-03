-- Ensure billing transaction ledger exists for Credits deduction RPC.
-- Some deployed databases had consume_credits_with_priority without this table,
-- which made successful purchased-credit deductions roll back as concurrent_limit.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
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
  ON public.credit_transactions(user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'credit_transactions'
      AND policyname = 'Users can read own credit transactions'
  ) THEN
    CREATE POLICY "Users can read own credit transactions"
      ON public.credit_transactions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.consume_credits_with_priority(
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
  SELECT total - used INTO v_monthly_remaining
  FROM public.credits
  WHERE user_id = p_user_id AND version = p_credits_version;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrent_limit');
  END IF;

  SELECT COALESCE(balance, 0) INTO v_purchased_balance
  FROM public.purchased_credits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    v_purchased_balance := 0;
  END IF;

  IF v_monthly_remaining + v_purchased_balance < p_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits');
  END IF;

  IF v_monthly_remaining >= p_total_cost THEN
    v_monthly_cost := p_total_cost;
    v_purchased_cost := 0;
  ELSE
    v_monthly_cost := v_monthly_remaining;
    v_purchased_cost := p_total_cost - v_monthly_remaining;
  END IF;

  UPDATE public.credits SET
    used = used + v_monthly_cost,
    version = version + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND version = p_credits_version;

  GET DIAGNOSTICS v_credits_updated = ROW_COUNT;
  IF v_credits_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'concurrent_limit');
  END IF;

  IF v_purchased_cost > 0 THEN
    UPDATE public.purchased_credits SET
      balance = balance - v_purchased_cost,
      version = version + 1,
      updated_at = now()
    WHERE user_id = p_user_id AND version = p_purchased_version;

    GET DIAGNOSTICS v_purchased_updated = ROW_COUNT;
    IF v_purchased_updated = 0 THEN
      RAISE EXCEPTION 'concurrent_limit';
    END IF;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, operation_type, total_cost, monthly_cost, purchased_cost,
    monthly_remaining_after, purchased_remaining_after
  ) VALUES (
    p_user_id, p_operation_type, p_total_cost, v_monthly_cost, v_purchased_cost,
    v_monthly_remaining - v_monthly_cost, v_purchased_balance - v_purchased_cost
  );

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
