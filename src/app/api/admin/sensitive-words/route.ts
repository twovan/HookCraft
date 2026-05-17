import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { SensitiveWordAdminService } from '../../../../lib/sensitivity/SensitiveWordAdminService';
import type { SensitiveWordCategory } from '@/types/sensitivity';

const adminService = new SensitiveWordAdminService(supabaseAdmin);

/**
 * GET /api/admin/sensitive-words
 * 获取敏感词列表（支持分页、按分类筛选）
 * Requirements: 8.1
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const category = searchParams.get('category') as SensitiveWordCategory | null;
    const search = searchParams.get('search') || '';

    // 参数校验
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'page 参数不合法' }, { status: 400 });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'pageSize 参数不合法（1-100）' }, { status: 400 });
    }
    if (category && !['celebrity', 'song_name', 'forbidden'].includes(category)) {
      return NextResponse.json({ error: 'category 参数不合法' }, { status: 400 });
    }

    const result = await adminService.list({
      page,
      pageSize,
      category: category || undefined,
      search: search || undefined,
    });

    return NextResponse.json({
      data: result.words,
      total: result.total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Admin Sensitive Words GET Error]', error);
    return NextResponse.json({ error: '获取敏感词列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/sensitive-words
 * 新增敏感词
 * Requirements: 8.2
 */
export async function POST(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const body = await request.json();
    const { word, category, variants, note } = body;

    // 参数校验
    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json({ error: '敏感词内容不能为空' }, { status: 400 });
    }
    if (!category || !['celebrity', 'song_name', 'forbidden'].includes(category)) {
      return NextResponse.json({ error: 'category 参数不合法' }, { status: 400 });
    }
    if (variants !== undefined && !Array.isArray(variants)) {
      return NextResponse.json({ error: 'variants 必须为数组' }, { status: 400 });
    }

    const created = await adminService.create({
      word,
      category,
      variants,
      note,
    });

    return NextResponse.json({ data: created, success: true }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Sensitive Words POST Error]', error);
    // 处理业务错误（如重复）
    if (error.message?.includes('已存在')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: '新增敏感词失败，请重试' }, { status: 500 });
  }
}
