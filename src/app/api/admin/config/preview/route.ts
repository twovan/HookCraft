import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/config/preview
 * 预览配置变更影响（差异对比、受影响用户数、涉及功能模块）
 *
 * Body: AdminConfigUpdate
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const service = new AdminConfigService(supabaseAdmin);
    const update = await req.json();
    const preview = await service.previewConfigChange(update);
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: '配置预览失败' }, { status: 500 });
  }
}
