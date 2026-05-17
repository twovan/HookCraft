import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { SensitiveWordAdminService } from '../../../../../lib/sensitivity/SensitiveWordAdminService';

const adminService = new SensitiveWordAdminService(supabaseAdmin);

/**
 * POST /api/admin/sensitive-words/batch
 * 批量导入敏感词
 * Requirements: 8.5
 */
export async function POST(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const body = await request.json();
    const { words } = body;

    // 参数校验
    if (!words || !Array.isArray(words)) {
      return NextResponse.json({ error: 'words 参数必须为数组' }, { status: 400 });
    }

    if (words.length === 0) {
      return NextResponse.json({ error: '导入列表不能为空' }, { status: 400 });
    }

    if (words.length > 500) {
      return NextResponse.json({ error: '单次批量导入不能超过 500 条' }, { status: 400 });
    }

    // 校验每条记录的格式
    for (let i = 0; i < words.length; i++) {
      const item = words[i];
      if (!item.word || typeof item.word !== 'string' || item.word.trim().length === 0) {
        return NextResponse.json(
          { error: `第 ${i + 1} 条记录的 word 不能为空` },
          { status: 400 }
        );
      }
      if (!item.category || !['celebrity', 'song_name', 'forbidden'].includes(item.category)) {
        return NextResponse.json(
          { error: `第 ${i + 1} 条记录的 category 不合法` },
          { status: 400 }
        );
      }
      if (item.variants !== undefined && !Array.isArray(item.variants)) {
        return NextResponse.json(
          { error: `第 ${i + 1} 条记录的 variants 必须为数组` },
          { status: 400 }
        );
      }
    }

    const result = await adminService.batchImport({ words });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
    });
  } catch (error: any) {
    console.error('[Admin Sensitive Words Batch Import Error]', error);
    return NextResponse.json({ error: '批量导入失败，请重试' }, { status: 500 });
  }
}
