import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { SensitiveWordAdminService } from '../../../../../lib/sensitivity/SensitiveWordAdminService';

const adminService = new SensitiveWordAdminService(supabaseAdmin);

/**
 * PUT /api/admin/sensitive-words/[id]
 * 编辑敏感词
 * Requirements: 8.3
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const { id } = await params;
    const body = await request.json();
    const { word, category, variants, note } = body;

    // 参数校验
    if (word !== undefined && (typeof word !== 'string' || word.trim().length === 0)) {
      return NextResponse.json({ error: '敏感词内容不能为空' }, { status: 400 });
    }
    if (category !== undefined && !['celebrity', 'song_name', 'forbidden'].includes(category)) {
      return NextResponse.json({ error: 'category 参数不合法' }, { status: 400 });
    }
    if (variants !== undefined && !Array.isArray(variants)) {
      return NextResponse.json({ error: 'variants 必须为数组' }, { status: 400 });
    }

    const updated = await adminService.update(id, {
      word,
      category,
      variants,
      note,
    });

    return NextResponse.json({ data: updated, success: true });
  } catch (error: any) {
    console.error('[Admin Sensitive Words PUT Error]', error);
    if (error.message?.includes('不存在')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes('已存在')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: '编辑敏感词失败，请重试' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sensitive-words/[id]
 * 删除敏感词
 * Requirements: 8.4
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const { id } = await params;

    await adminService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Admin Sensitive Words DELETE Error]', error);
    if (error.message?.includes('不存在')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: '删除敏感词失败，请重试' }, { status: 500 });
  }
}
