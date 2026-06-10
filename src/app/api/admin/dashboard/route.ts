import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

const ACTIVE_TASK_STATUSES = new Set(['pending', 'building_prompt', 'generating', 'post_processing']);
const FINISHED_TASK_STATUSES = new Set(['completed', 'selected', 'archived']);

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeTaskStatus(task: any) {
  if (task.error_code || task.error_message) return 'failed';
  if (task.status === 'completed' && !task.audio_path && task.raw_audio_path) return 'generating';
  return task.status || 'pending';
}

function getElapsedSeconds(task: any) {
  if (!task.created_at || !task.updated_at) return 0;

  const startedAt = new Date(task.created_at).getTime();
  const endedAt = new Date(task.updated_at).getTime();
  const seconds = Math.round((endedAt - startedAt) / 1000);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function formatDuration(seconds: number) {
  if (!seconds) return '暂无完成样本';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function getTaskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '排队中',
    building_prompt: '构建 Prompt',
    generating: '生成中',
    post_processing: '后处理',
    completed: '已完成',
    selected: '已选用',
    archived: '已归档',
    failed: '失败',
    safety_blocked: '安全拦截',
  };
  return labels[status] || status;
}

function getTaskTypeLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    preview: '预览生成',
    full_demo: '完整生成',
    upload_cover: '上传翻唱',
    add_instrumental: '加伴奏',
    style_dna: 'Style DNA',
  };
  return labels[type || ''] || type || '未知任务';
}

function getTemplateStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: '待审核',
    published: '已发布',
    rejected: '已拒绝',
    unpublished: '未发布',
  };
  return labels[status || ''] || status || '未知';
}

function getPaymentStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    completed: '已完成',
    pending: '处理中',
    failed: '失败',
    refunded: '已退款',
  };
  return labels[status || ''] || status || '未知';
}

function buildUserNameMap(users: any[]) {
  return users.reduce<Record<string, string>>((map, user) => {
    map[user.id] = user.user_metadata?.display_name
      || user.user_metadata?.name
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || user.id.slice(0, 8);
    return map;
  }, {});
}

function pushActivity(
  activities: { type: string; description: string; actor: string; time: string; status?: string }[],
  item: { type: string; description: string; actor?: string; time?: string | null; status?: string }
) {
  if (!item.time) return;
  activities.push({
    type: item.type,
    description: item.description,
    actor: item.actor || 'system',
    time: item.time,
    status: item.status,
  });
}

/**
 * GET /api/admin/dashboard
 * Aggregates real admin metrics for the dashboard control room.
 */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const trendPeriod = searchParams.get('trendPeriod') || 'week';

    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const last24h = addDays(now, -1);
    const last7d = addDays(now, -7);

    const [
      usersResult,
      templatesResult,
      allTemplatesResult,
      paymentsResult,
      previousPaymentsResult,
      recentPaymentsResult,
      membershipsResult,
      monthlyTasksResult,
      recentTasksResult,
      tasks24hResult,
      pendingReviewsResult,
      todayReviewedResult,
      reviewedTemplatesResult,
      newTemplatesTodayResult,
      sensitivity24hResult,
      sensitiveWordsResult,
      operationLogsResult,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('templates').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('templates')
        .select('id, name, category, price, sales_count, status, created_at, updated_at')
        .order('sales_count', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('payments')
        .select('amount')
        .gte('created_at', monthStart.toISOString())
        .eq('status', 'completed'),
      supabaseAdmin
        .from('payments')
        .select('amount')
        .gte('created_at', previousMonthStart.toISOString())
        .lte('created_at', previousMonthEnd.toISOString())
        .eq('status', 'completed'),
      supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6),
      supabaseAdmin.from('memberships').select('tier'),
      supabaseAdmin
        .from('generation_tasks')
        .select('credits_consumed')
        .gte('created_at', monthStart.toISOString()),
      supabaseAdmin
        .from('generation_tasks')
        .select('id, user_id, generation_type, status, credits_consumed, created_at, updated_at, audio_path, raw_audio_path, error_code, error_message, model_id')
        .order('created_at', { ascending: false })
        .limit(8),
      supabaseAdmin
        .from('generation_tasks')
        .select('id, user_id, generation_type, status, credits_consumed, created_at, updated_at, audio_path, raw_audio_path, error_code, error_message, model_id')
        .gte('created_at', last24h.toISOString()),
      supabaseAdmin
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .in('status', ['published', 'rejected'])
        .gte('updated_at', todayStart.toISOString()),
      supabaseAdmin
        .from('templates')
        .select('created_at, updated_at')
        .in('status', ['published', 'rejected'])
        .gte('updated_at', last7d.toISOString()),
      supabaseAdmin
        .from('templates')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabaseAdmin
        .from('sensitivity_logs')
        .select('result_type, detected_words, created_at, duration_ms')
        .gte('created_at', last24h.toISOString()),
      supabaseAdmin
        .from('sensitive_words')
        .select('word, category, hit_count, last_hit_at')
        .order('hit_count', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('operation_logs')
        .select('operator_name, operation_type, operation_description, target_type, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const users = usersResult.data?.users || [];
    const userNameMap = buildUserNameMap(users);
    const totalUsers = (usersResult.data as any)?.total || users.length || 0;
    const totalTemplates = templatesResult.count || 0;

    const monthlyRevenue = (paymentsResult.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const previousMonthlyRevenue = (previousPaymentsResult.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const monthlyCreditsConsumed = (monthlyTasksResult.data || []).reduce((sum: number, t: any) => sum + (t.credits_consumed || 0), 0);

    const membershipData = membershipsResult.data || [];
    const tierCounts: Record<string, number> = { free: 0, pro: 0, business: 0 };
    membershipData.forEach((m: any) => {
      const tier = (m.tier || 'free').toLowerCase();
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    const totalMembers = Math.max(membershipData.length, 1);
    const membershipDistribution = Object.entries(tierCounts).map(([tier, count]) => ({
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      count,
      percentage: Math.round((count / totalMembers) * 100),
    }));

    const recentOrders = (recentPaymentsResult.data || []).map((p: any) => ({
      orderNumber: p.id?.slice(0, 8) || 'N/A',
      userName: userNameMap[p.user_id] || p.user_id?.slice(0, 8) || '用户',
      templateName: p.description || (p.tier === 'free' ? 'Credits Pack' : `${p.tier || 'membership'} ${p.billing_cycle || ''}`.trim()) || '订单',
      amount: p.amount || 0,
      status: p.status || 'pending',
      statusLabel: getPaymentStatusLabel(p.status),
      createdAt: p.created_at,
    }));

    const topTemplates = (allTemplatesResult.data || []).slice(0, 5).map((t: any) => ({
      name: t.name || '未命名模板',
      category: t.category || '未分类',
      price: t.price || 0,
      salesCount: t.sales_count || 0,
      status: t.status || 'unknown',
      statusLabel: getTemplateStatusLabel(t.status),
    }));

    const trendBuckets: { start: Date; end: Date; label: string }[] = [];
    if (trendPeriod === 'day') {
      for (let i = 6; i >= 0; i--) {
        const start = startOfDay(addDays(now, -i));
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        trendBuckets.push({ start, end, label: `${start.getMonth() + 1}/${start.getDate()}` });
      }
    } else if (trendPeriod === 'month') {
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        trendBuckets.push({ start, end, label: `${start.getMonth() + 1}月` });
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const end = addDays(now, -i * 7);
        end.setHours(23, 59, 59, 999);
        const start = addDays(end, -6);
        start.setHours(0, 0, 0, 0);
        trendBuckets.push({ start, end, label: `W${7 - i}` });
      }
    }

    const revenueTrend = await Promise.all(trendBuckets.map(async (bucket) => {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('amount')
        .gte('created_at', bucket.start.toISOString())
        .lte('created_at', bucket.end.toISOString())
        .eq('status', 'completed');

      return {
        label: bucket.label,
        amount: (data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      };
    }));

    const tasks24h = (tasks24hResult.data || []).map((task: any) => ({
      ...task,
      normalizedStatus: normalizeTaskStatus(task),
    }));
    const completed24h = tasks24h.filter((t: any) => FINISHED_TASK_STATUSES.has(t.normalizedStatus)).length;
    const failed24h = tasks24h.filter((t: any) => t.normalizedStatus === 'failed' || t.normalizedStatus === 'safety_blocked').length;
    const activeTasks = tasks24h.filter((t: any) => ACTIVE_TASK_STATUSES.has(t.normalizedStatus)).length;
    const successRate = completed24h + failed24h > 0 ? Math.round((completed24h / (completed24h + failed24h)) * 1000) / 10 : 100;
    const completedDurations = tasks24h
      .filter((t: any) => FINISHED_TASK_STATUSES.has(t.normalizedStatus))
      .map(getElapsedSeconds)
      .filter((seconds: number) => seconds > 0 && seconds < 7200);
    const avgDurationSeconds = completedDurations.length > 0
      ? Math.round(completedDurations.reduce((sum: number, seconds: number) => sum + seconds, 0) / completedDurations.length)
      : 0;

    const aiQueue = {
      activeTasks,
      queuedTasks: tasks24h.filter((t: any) => t.normalizedStatus === 'pending').length,
      completed24h,
      failed24h,
      successRate,
      avgDurationSeconds,
      avgDurationLabel: formatDuration(avgDurationSeconds),
      rows: (recentTasksResult.data || []).slice(0, 5).map((task: any) => {
        const status = normalizeTaskStatus(task);
        return {
          id: task.id,
          shortId: task.id?.slice(0, 8) || 'N/A',
          type: getTaskTypeLabel(task.generation_type),
          status,
          statusLabel: getTaskStatusLabel(status),
          creditsConsumed: task.credits_consumed || 0,
          modelId: task.model_id || '-',
          createdAt: task.created_at,
        };
      }),
    };

    const rewriteCount24h = (sensitivity24hResult.data || []).filter((l: any) => l.result_type === 'rewrite').length;
    const blockCount24h = (sensitivity24hResult.data || []).filter((l: any) => l.result_type === 'block').length;
    const passCount24h = (sensitivity24hResult.data || []).filter((l: any) => l.result_type === 'pass').length;
    const reviewDurations = (reviewedTemplatesResult.data || [])
      .map((t: any) => {
        const created = new Date(t.created_at).getTime();
        const updated = new Date(t.updated_at).getTime();
        const hours = (updated - created) / 1000 / 60 / 60;
        return Number.isFinite(hours) && hours >= 0 ? hours : null;
      })
      .filter((hours: number | null): hours is number => hours !== null);
    const avgReviewHours = reviewDurations.length > 0
      ? Math.round((reviewDurations.reduce((sum, hours) => sum + hours, 0) / reviewDurations.length) * 10) / 10
      : null;

    const reviewRisk = {
      pendingReviews: pendingReviewsResult.count || 0,
      todayReviewed: todayReviewedResult.count || 0,
      avgReviewHours,
      newTemplatesToday: newTemplatesTodayResult.count || 0,
      sensitivityPass24h: passCount24h,
      sensitivityRewrite24h: rewriteCount24h,
      sensitivityBlock24h: blockCount24h,
      highRiskWords: (sensitiveWordsResult.data || []).map((word: any) => ({
        word: word.word,
        category: word.category,
        hitCount: word.hit_count || 0,
        lastHitAt: word.last_hit_at,
      })),
    };

    const recentActivity: { type: string; description: string; actor: string; time: string; status?: string }[] = [];
    users.slice(0, 5).forEach((user: any) => {
      pushActivity(recentActivity, {
        type: 'user',
        description: `新用户注册：${userNameMap[user.id] || user.email || user.id.slice(0, 8)}`,
        actor: user.email || 'auth',
        time: user.created_at,
      });
    });
    (recentPaymentsResult.data || []).forEach((payment: any) => {
      pushActivity(recentActivity, {
        type: 'order',
        description: `订单 ${payment.id?.slice(0, 8) || 'N/A'} ${getPaymentStatusLabel(payment.status)}，金额 ¥${((payment.amount || 0) / 100).toFixed(2)}`,
        actor: userNameMap[payment.user_id] || payment.user_id?.slice(0, 8) || '用户',
        time: payment.created_at,
        status: payment.status,
      });
    });
    (recentTasksResult.data || []).forEach((task: any) => {
      const status = normalizeTaskStatus(task);
      pushActivity(recentActivity, {
        type: status === 'failed' ? 'risk' : 'ai',
        description: `${getTaskTypeLabel(task.generation_type)} ${getTaskStatusLabel(status)}，消耗 ${task.credits_consumed || 0} Credits`,
        actor: userNameMap[task.user_id] || task.user_id?.slice(0, 8) || '用户',
        time: task.updated_at || task.created_at,
        status,
      });
    });
    (allTemplatesResult.data || []).slice(0, 6).forEach((template: any) => {
      pushActivity(recentActivity, {
        type: 'content',
        description: `模板 ${template.name || template.id?.slice(0, 8)}：${getTemplateStatusLabel(template.status)}`,
        actor: template.category || 'template',
        time: template.updated_at || template.created_at,
        status: template.status,
      });
    });
    (operationLogsResult.data || []).forEach((log: any) => {
      pushActivity(recentActivity, {
        type: log.operation_type || 'system',
        description: log.operation_description,
        actor: log.operator_name || 'admin',
        time: log.created_at,
        status: log.target_type,
      });
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      totalUsers,
      monthlyRevenue,
      previousMonthlyRevenue,
      totalTemplates,
      monthlyCreditsConsumed,
      recentOrders,
      membershipDistribution,
      topTemplates,
      recentActivity: recentActivity
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8),
      revenueTrend,
      aiQueue,
      reviewRisk,
    });
  } catch (error) {
    console.error('[Admin Dashboard API Error]', error);
    return NextResponse.json({ error: '获取仪表盘数据失败，请重试' }, { status: 500 });
  }
}
