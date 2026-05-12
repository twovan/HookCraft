import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/review
 * 获取待审核内容列表
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const type = searchParams.get('type') || ''; // 'template' | 'ai_publish'

    // Query pending templates as review items
    let query = supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact' })
      .eq('status', 'pending');

    // If type filter is specified, we can differentiate by producer_id presence
    if (type === 'template') {
      query = query.not('producer_id', 'is', null);
    } else if (type === 'ai_publish') {
      query = query.is('producer_id', null);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Get stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: pendingCount } = await supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Today's reviewed (published or rejected today)
    const { count: todayReviewed } = await supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact', head: true })
      .in('status', ['published', 'rejected'])
      .gte('created_at', today.toISOString());

    // Map to review items
    const reviewItems = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      submitter: item.producer_id?.slice(0, 8) || '系统',
      type: item.producer_id ? 'template' : 'ai_publish',
      submittedAt: item.created_at,
      category: item.category,
      genre_tags: item.genre_tags,
    }));

    return NextResponse.json({
      data: reviewItems,
      total: count || 0,
      page,
      pageSize,
      stats: {
        pending: pendingCount || 0,
        todayReviewed: todayReviewed || 0,
        avgDuration: '2.5h', // Placeholder
      },
    });
  } catch (error) {
    console.error('[Admin Review GET Error]', error);
    return NextResponse.json({ error: '获取审核列表失败' }, { status: 500 });
  }
}
