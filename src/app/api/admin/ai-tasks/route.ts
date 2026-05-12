import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/ai-tasks
 * 获取 AI 生成任务列表和统计
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const status = searchParams.get('status') || '';

    // Build query
    let query = supabaseAdmin
      .from('generation_tasks')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status as any);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: tasks, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Stats - today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const { data: todayTasks } = await supabaseAdmin
      .from('generation_tasks')
      .select('status, credits_consumed, created_at, updated_at')
      .gte('created_at', todayStr);

    const allToday = todayTasks || [];
    const dailyCredits = allToday.reduce((sum: number, t: any) => sum + (t.credits_consumed || 1), 0);
    const activeTasks = allToday.filter((t: any) => t.status === 'generating' || t.status === 'pending' || t.status === 'building_prompt').length;
    const completedToday = allToday.filter((t: any) => t.status === 'completed').length;
    const failedToday = allToday.filter((t: any) => t.status === 'failed').length;
    const successRate = (completedToday + failedToday) > 0
      ? Math.round((completedToday / (completedToday + failedToday)) * 100)
      : 100;

    // Calculate average duration from created_at to updated_at for completed tasks
    const completedTasks = allToday.filter((t: any) => t.status === 'completed' && t.updated_at);
    const durations = completedTasks.map((t: any) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.updated_at).getTime();
      return Math.round((end - start) / 1000);
    }).filter((d: number) => d > 0 && d < 3600);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

    // Popular styles (from generation_type)
    const { data: allTodayFull } = await supabaseAdmin
      .from('generation_tasks')
      .select('generation_type, model_id')
      .gte('created_at', todayStr);

    const styleCounts: Record<string, number> = {};
    (allTodayFull || []).forEach((t: any) => {
      const style = t.generation_type || 'unknown';
      styleCounts[style] = (styleCounts[style] || 0) + 1;
    });
    const totalStyleTasks = Object.values(styleCounts).reduce((a, b) => a + b, 0);
    const popularStyles = Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([style, cnt]) => ({
        style: style === 'preview' ? '预览生成' : style === 'full_demo' ? '完整生成' : style,
        count: cnt,
        percentage: totalStyleTasks > 0 ? Math.round((cnt / totalStyleTasks) * 100) : 0,
      }));

    // Failure reasons
    const { data: failedTasksList } = await supabaseAdmin
      .from('generation_tasks')
      .select('error_message')
      .eq('status', 'failed')
      .gte('created_at', todayStr);

    const failureCounts: Record<string, number> = {};
    (failedTasksList || []).forEach((t: any) => {
      const reason = t.error_message || '未知错误';
      failureCounts[reason] = (failureCounts[reason] || 0) + 1;
    });
    const totalFailures = Object.values(failureCounts).reduce((a, b) => a + b, 0);
    const failureReasons = Object.entries(failureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, cnt]) => ({
        reason,
        count: cnt,
        percentage: totalFailures > 0 ? Math.round((cnt / totalFailures) * 100) : 0,
      }));

    return NextResponse.json({
      data: (tasks || []).map((t: any) => {
        const elapsed = t.updated_at && t.status === 'completed'
          ? Math.round((new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 1000)
          : 0;
        return {
          id: t.id,
          userId: t.user_id,
          userName: t.user_id?.slice(0, 8) || '用户',
          styleTag: t.generation_type === 'preview' ? '预览' : '完整',
          duration: t.credits_consumed || 0,
          status: t.status,
          elapsedTime: elapsed,
          createdAt: t.created_at,
        };
      }),
      total: count || 0,
      page,
      pageSize,
      stats: {
        dailyCredits,
        activeTasks,
        successRate,
        avgDuration,
      },
      popularStyles,
      failureReasons,
    });
  } catch (error) {
    console.error('[Admin AI Tasks GET Error]', error);
    return NextResponse.json({ error: '获取AI任务列表失败' }, { status: 500 });
  }
}
