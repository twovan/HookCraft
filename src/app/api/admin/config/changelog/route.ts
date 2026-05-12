import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/config/changelog?limit=20
 * 获取配置变更历史
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    const service = new AdminConfigService(supabaseAdmin);
    const history = await service.getChangeHistory(limit);
    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: '获取变更历史失败' }, { status: 500 });
  }
}
