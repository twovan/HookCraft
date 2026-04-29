-- 004_create_triggers.sql
-- 创建触发器函数和 RPC 函数
-- 使用 CREATE OR REPLACE FUNCTION 确保幂等性

-- ============================================================
-- handle_new_user() 触发器函数
-- 新用户注册时自动初始化 memberships、credits、preview_counts
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建默认会员记录（tier=free, status=active）
  INSERT INTO memberships (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active');

  -- 创建默认 Credits 记录（Free 用户 total=0）
  INSERT INTO credits (user_id, tier, used, total, period_start, period_end)
  VALUES (NEW.id, 'free', 0, 0, now(), now() + INTERVAL '1 month');

  -- 创建默认 Preview 次数记录（total=3）
  INSERT INTO preview_counts (user_id, used, total)
  VALUES (NEW.id, 0, 3);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器（先删除再创建确保幂等性）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- upgrade_membership() RPC 函数
-- 事务性升级：同时更新 memberships 和 credits 表
-- ============================================================
CREATE OR REPLACE FUNCTION upgrade_membership(
  p_user_id UUID,
  p_target_tier membership_tier,
  p_billing_cycle billing_cycle,
  p_monthly_credits INTEGER
)
RETURNS VOID AS $$
BEGIN
  -- 更新会员等级
  UPDATE memberships
  SET tier = p_target_tier,
      billing_cycle = p_billing_cycle,
      status = 'active',
      auto_renew = true,
      start_date = COALESCE(start_date, now()),
      expires_at = COALESCE(expires_at, now() + INTERVAL '1 month'),
      grace_period_end = NULL,
      pending_downgrade_tier = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- 同步更新 Credits 配额
  UPDATE credits
  SET tier = p_target_tier,
      total = p_monthly_credits,
      used = 0,
      version = version + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
