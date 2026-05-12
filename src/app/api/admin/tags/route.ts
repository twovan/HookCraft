import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/tags
 * 获取标签/风格列表（含模板数量）
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    // Fetch tags
    const { data: tags, error } = await supabaseAdmin
      .from('tags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet, return empty
      return NextResponse.json({ data: [], total: 0 });
    }

    // Count templates per tag (using genre field or tags array)
    const tagsWithCounts = await Promise.all(
      (tags || []).map(async (tag: any) => {
        const { count } = await supabaseAdmin
          .from('templates')
          .select('*', { count: 'exact', head: true })
          .contains('genre_tags', [tag.name] as any);
        return {
          id: tag.id,
          name: tag.name,
          icon: tag.icon || '',
          enabled: tag.enabled !== false,
          templateCount: count || 0,
          createdAt: tag.created_at,
        };
      })
    );

    return NextResponse.json({
      data: tagsWithCounts,
      total: tagsWithCounts.length,
    });
  } catch (error) {
    console.error('[Admin Tags GET Error]', error);
    return NextResponse.json({ error: '获取标签列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/tags
 * 创建新标签/风格
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { name, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tags')
      .insert({ name: name.trim(), icon: icon || '', enabled: true })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '标签名称已存在' }, { status: 400 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `创建标签: ${name}`,
      target_type: 'tag',
      target_id: data.id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Tags POST Error]', error);
    return NextResponse.json({ error: '创建标签失败，请重试' }, { status: 500 });
  }
}
