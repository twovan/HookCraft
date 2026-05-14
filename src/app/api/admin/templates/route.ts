import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/templates
 * 获取模板列表（分页、搜索、筛选）
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const genre = searchParams.get('genre') || '';
    const status = searchParams.get('status') || '';
    const hasAudio = searchParams.get('hasAudio') || '';
    const includeStats = searchParams.get('includeStats') === 'true';

    let query = supabaseAdmin
      .from('templates')
      .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (category) {
      query = query.eq('category', category as any);
    }
    if (genre) {
      query = query.contains('genre_tags', [genre] as any);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (hasAudio === 'yes') {
      query = query.not('preview_url', 'is', null);
    } else if (hasAudio === 'no') {
      query = query.is('preview_url', null);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const result: Record<string, unknown> = {
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    };

    // Optionally include stats in one request
    if (includeStats) {
      const [totalRes, pubRes, pendRes, unpubRes] = await Promise.all([
        supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }).eq('status', 'unpublished'),
      ]);
      result.stats = {
        total: totalRes.count || 0,
        published: pubRes.count || 0,
        pending: pendRes.count || 0,
        unpublished: unpubRes.count || 0,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Templates GET Error]', error);
    return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/templates
 * 创建新模板
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { name, description, category, genre_tags, price, status: templateStatus } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .insert({
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description || '',
        category: category || 'free_template',
        genre: (genre_tags || []).join(', '),
        genre_tags: genre_tags || [],
        price: price || 0,
        status: templateStatus || 'pending',
        producer_id: admin.adminId,
        sales_count: 0,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `创建模板: ${name}`,
      target_type: 'template',
      target_id: data.id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Templates POST Error]', error);
    return NextResponse.json({ error: '创建模板失败，请重试' }, { status: 500 });
  }
}
