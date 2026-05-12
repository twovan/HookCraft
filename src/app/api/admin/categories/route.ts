import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/categories
 * 获取分类列表（含模板数量）
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    // Fetch categories
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet, return empty
      return NextResponse.json({ data: [], total: 0 });
    }

    // Count templates per category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (cat: any) => {
        const { count } = await supabaseAdmin
          .from('templates')
          .select('*', { count: 'exact', head: true })
          .eq('category', cat.name);
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon || '',
          enabled: cat.enabled !== false,
          templateCount: count || 0,
          createdAt: cat.created_at,
        };
      })
    );

    return NextResponse.json({
      data: categoriesWithCounts,
      total: categoriesWithCounts.length,
    });
  } catch (error) {
    console.error('[Admin Categories GET Error]', error);
    return NextResponse.json({ error: '获取分类列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/categories
 * 创建新分类
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { name, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({ name: name.trim(), icon: icon || '', enabled: true })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '分类名称已存在' }, { status: 400 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `创建分类: ${name}`,
      target_type: 'category',
      target_id: data.id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Categories POST Error]', error);
    return NextResponse.json({ error: '创建分类失败，请重试' }, { status: 500 });
  }
}
