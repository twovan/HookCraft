-- 003_create_rls_policies.sql
-- 为所有用户数据表启用 RLS 并创建访问策略
-- 使用 DROP POLICY IF EXISTS + CREATE POLICY 确保幂等性

-- ============================================================
-- memberships: 用户可读自己的记录，仅服务端可写
-- ============================================================
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的会员信息" ON memberships;
CREATE POLICY "用户可读取自己的会员信息" ON memberships
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入会员记录" ON memberships;
CREATE POLICY "仅服务端可插入会员记录" ON memberships
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新会员记录" ON memberships;
CREATE POLICY "仅服务端可更新会员记录" ON memberships
  FOR UPDATE USING (false);

-- ============================================================
-- credits: 用户可读自己的记录，仅服务端可写
-- ============================================================
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的额度" ON credits;
CREATE POLICY "用户可读取自己的额度" ON credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可更新额度" ON credits;
CREATE POLICY "仅服务端可更新额度" ON credits
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "仅服务端可插入额度" ON credits;
CREATE POLICY "仅服务端可插入额度" ON credits
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- credit_history: 用户可读自己的历史
-- ============================================================
ALTER TABLE credit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的历史" ON credit_history;
CREATE POLICY "用户可读取自己的历史" ON credit_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入历史" ON credit_history;
CREATE POLICY "仅服务端可插入历史" ON credit_history
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- preview_counts: 用户可读自己的记录，仅服务端可写
-- ============================================================
ALTER TABLE preview_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的预览次数" ON preview_counts;
CREATE POLICY "用户可读取自己的预览次数" ON preview_counts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可更新预览次数" ON preview_counts;
CREATE POLICY "仅服务端可更新预览次数" ON preview_counts
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "仅服务端可插入预览次数" ON preview_counts;
CREATE POLICY "仅服务端可插入预览次数" ON preview_counts
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- templates: 所有认证用户可读，仅管理员可写
-- ============================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "认证用户可读取模板" ON templates;
CREATE POLICY "认证用户可读取模板" ON templates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "仅管理员可插入模板" ON templates;
CREATE POLICY "仅管理员可插入模板" ON templates
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "仅管理员可更新模板" ON templates;
CREATE POLICY "仅管理员可更新模板" ON templates
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- generation_tasks: 用户可读自己的任务，仅服务端可写
-- ============================================================
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的任务" ON generation_tasks;
CREATE POLICY "用户可读取自己的任务" ON generation_tasks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入任务" ON generation_tasks;
CREATE POLICY "仅服务端可插入任务" ON generation_tasks
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新任务" ON generation_tasks;
CREATE POLICY "仅服务端可更新任务" ON generation_tasks
  FOR UPDATE USING (false);

-- ============================================================
-- payment_sessions: 用户可读自己的会话
-- ============================================================
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的支付会话" ON payment_sessions;
CREATE POLICY "用户可读取自己的支付会话" ON payment_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入支付会话" ON payment_sessions;
CREATE POLICY "仅服务端可插入支付会话" ON payment_sessions
  FOR INSERT WITH CHECK (false);

-- ============================================================
-- payments: 用户可读自己的支付记录
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的支付记录" ON payments;
CREATE POLICY "用户可读取自己的支付记录" ON payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入支付记录" ON payments;
CREATE POLICY "仅服务端可插入支付记录" ON payments
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新支付记录" ON payments;
CREATE POLICY "仅服务端可更新支付记录" ON payments
  FOR UPDATE USING (false);

-- ============================================================
-- processed_webhook_events: 仅服务端可读写
-- ============================================================
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "仅服务端可访问 webhook 事件" ON processed_webhook_events;
CREATE POLICY "仅服务端可访问 webhook 事件" ON processed_webhook_events
  FOR ALL USING (false);

-- ============================================================
-- admin_config: 仅管理员可读写
-- ============================================================
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "仅管理员可读取配置" ON admin_config;
CREATE POLICY "仅管理员可读取配置" ON admin_config
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "仅管理员可更新配置" ON admin_config;
CREATE POLICY "仅管理员可更新配置" ON admin_config
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- config_changelog: 仅管理员可读写
-- ============================================================
ALTER TABLE config_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "仅管理员可读取变更日志" ON config_changelog;
CREATE POLICY "仅管理员可读取变更日志" ON config_changelog
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "仅管理员可插入变更日志" ON config_changelog;
CREATE POLICY "仅管理员可插入变更日志" ON config_changelog
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================================
-- downgraded_file_access: 用户可读自己的记录
-- ============================================================
ALTER TABLE downgraded_file_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户可读取自己的降级文件" ON downgraded_file_access;
CREATE POLICY "用户可读取自己的降级文件" ON downgraded_file_access
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "仅服务端可插入降级文件" ON downgraded_file_access;
CREATE POLICY "仅服务端可插入降级文件" ON downgraded_file_access
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "仅服务端可更新降级文件" ON downgraded_file_access;
CREATE POLICY "仅服务端可更新降级文件" ON downgraded_file_access
  FOR UPDATE USING (false);
