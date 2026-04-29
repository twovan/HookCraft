import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getAuthUser, isAdmin } from '../../../../../lib/supabase/auth-helpers';

/**
 * POST /api/admin/config/preview
 * 预览配置变更影响（差异对比、受影响用户数、涉及功能模块）
 *
 * Body: AdminConfigUpdate
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: '无权访问，需要管理员权限' }, { status: 403 });
    }

    const service = new AdminConfigService(supabaseAdmin);
    const update = await req.json();
    const preview = await service.previewConfigChange(update);
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: '配置预览失败' }, { status: 500 });
  }
}
