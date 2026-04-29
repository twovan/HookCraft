import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getAuthUser, isAdmin } from '../../../../../lib/supabase/auth-helpers';

/**
 * GET /api/admin/config/changelog?limit=20
 * 获取配置变更历史
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: '无权访问，需要管理员权限' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    const service = new AdminConfigService(supabaseAdmin);
    const history = await service.getChangeHistory(limit);
    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json({ error: '获取变更历史失败' }, { status: 500 });
  }
}
