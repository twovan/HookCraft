import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

const ACTIVE_STATUSES = new Set(['pending', 'building_prompt', 'generating', 'post_processing']);
const FINISHED_STATUSES = new Set(['completed', 'selected', 'archived']);

function normalizeTaskStatus(task: any) {
  if (task.error_code || task.error_message) return 'failed';
  if (task.status === 'completed' && !task.audio_path && task.raw_audio_path) return 'generating';
  return task.status || 'pending';
}

function getElapsedSeconds(task: any) {
  if (!task.created_at) return 0;

  const startedAt = new Date(task.created_at).getTime();
  const endedAt = task.updated_at && !ACTIVE_STATUSES.has(normalizeTaskStatus(task))
    ? new Date(task.updated_at).getTime()
    : Date.now();
  const seconds = Math.round((endedAt - startedAt) / 1000);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function getDurationSeconds(task: any) {
  return typeof task.duration_seconds === 'number' && task.duration_seconds > 0
    ? task.duration_seconds
    : null;
}

function getStyleTag(task: any) {
  const typeMap: Record<string, string> = {
    preview: '预览',
    full_demo: '完整',
    upload_cover: '上传翻唱',
    add_instrumental: '加伴奏',
    style_dna: '风格 DNA',
  };
  const parts = [typeMap[task.generation_type] || task.generation_type || '未知类型'];

  if (task.model_id) parts.push(task.model_id);
  if (task.version_number) parts.push(`v${task.version_number}`);
  if (task.raw_audio_path?.startsWith('kie:')) parts.push(task.raw_audio_path.slice(4));

  return parts.join(' / ');
}

/**
 * GET /api/admin/ai-tasks
 * 获取 AI 生成任务列表和统计。
 */
export async function GET(req: NextRequest) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const status = searchParams.get('status') || '';

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const { data: todayTasks } = await supabaseAdmin
      .from('generation_tasks')
      .select('status, credits_consumed, created_at, updated_at, audio_path, raw_audio_path, error_code, error_message')
      .gte('created_at', todayStr);

    const todayWithRealStatus = (todayTasks || []).map((t: any) => ({
      ...t,
      status: normalizeTaskStatus(t),
    }));
    const dailyCredits = todayWithRealStatus.reduce((sum: number, t: any) => sum + (t.credits_consumed || 0), 0);
    const activeTasks = todayWithRealStatus.filter((t: any) => ACTIVE_STATUSES.has(t.status)).length;
    const completedToday = todayWithRealStatus.filter((t: any) => FINISHED_STATUSES.has(t.status)).length;
    const failedToday = todayWithRealStatus.filter((t: any) => t.status === 'failed' || t.status === 'safety_blocked').length;
    const successRate = (completedToday + failedToday) > 0
      ? Math.round((completedToday / (completedToday + failedToday)) * 100)
      : 100;

    const completedTasks = todayWithRealStatus.filter((t: any) => FINISHED_STATUSES.has(t.status) && t.updated_at);
    const durations = completedTasks.map(getElapsedSeconds).filter((d: number) => d > 0 && d < 3600);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

    const { data: allTodayFull } = await supabaseAdmin
      .from('generation_tasks')
      .select('generation_type')
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
        const normalizedStatus = normalizeTaskStatus(t);

        return {
          id: t.id,
          userId: t.user_id,
          userName: t.user_id || '未知用户',
          styleTag: getStyleTag(t),
          duration: getDurationSeconds(t),
          creditsConsumed: t.credits_consumed || 0,
          status: normalizedStatus,
          originalStatus: t.status,
          elapsedTime: getElapsedSeconds(t),
          modelId: t.model_id,
          versionNumber: t.version_number,
          errorMessage: t.error_message,
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
    return NextResponse.json({ error: '获取 AI 任务列表失败' }, { status: 500 });
  }
}
