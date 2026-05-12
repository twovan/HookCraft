import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';

/**
 * GET /api/batches
 *
 * 获取用户生成历史批次列表。
 * 支持查询参数：range（7d/30d/all）、page、pageSize（默认 20）
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabaseAdmin
      .from('generation_batches')
      .select('*, templates(name)', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply time range filter
    if (range === '7d') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', sevenDaysAgo);
    } else if (range === '30d') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', thirtyDaysAgo);
    }

    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('batches query error:', error);
      return NextResponse.json(
        { error: '查询失败' },
        { status: 500 }
      );
    }

    // Map to BatchListResponse
    const batches = (data ?? []).map((batch: any) => ({
      batchId: batch.id,
      createdAt: batch.created_at,
      templateName: batch.templates?.name ?? null,
      promptSummary: batch.prompt ? batch.prompt.slice(0, 50) : null,
      generationType: batch.generation_type,
      versionCount: batch.version_count,
      selectedVersionId: batch.selected_task_id,
      status: batch.status,
    }));

    return NextResponse.json({
      batches,
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('batches error:', error);
    return NextResponse.json(
      { error: '获取历史记录失败' },
      { status: 500 }
    );
  }
}
