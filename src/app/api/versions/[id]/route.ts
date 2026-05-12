import { NextRequest, NextResponse } from 'next/server';
import { MusicGenerationService } from '../../../../lib/generation/MusicGenerationService';
import { LyriaProvider } from '../../../../lib/generation/LyriaProvider';
import { CreditService } from '../../../../lib/credits/CreditService';
import { TemplateService } from '../../../../lib/template/TemplateService';
import { TemplateAdminService } from '../../../../lib/admin/TemplateAdminService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';

/**
 * POST /api/versions/[id]/select
 *
 * 选择版本。[id] 为 taskId，body 中包含 batchId。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { batchId } = body as { batchId: string };

    if (!batchId) {
      return NextResponse.json(
        { error: '请提供批次 ID' },
        { status: 400 }
      );
    }

    // Initialize service
    const apiKey = process.env.GEMINI_API_KEY || '';
    const provider = new LyriaProvider(apiKey);
    const creditService = new CreditService(supabaseAdmin);
    const templateService = new TemplateService(supabaseAdmin);
    const templateAdminService = new TemplateAdminService(supabaseAdmin);

    const service = new MusicGenerationService({
      supabase: supabaseAdmin,
      provider,
      creditService,
      templateService,
      templateAdminService,
    });

    // Call selectVersion
    const result = await service.selectVersion(user.id, batchId, taskId);

    return NextResponse.json({
      success: result.success,
      selectedTaskId: result.selectedTaskId,
      archivedTaskIds: result.archivedTaskIds,
    });
  } catch (error: any) {
    console.error('select version error:', error);
    const message = error?.message || '版本选择失败，请重试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
