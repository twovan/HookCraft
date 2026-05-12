import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/config/quota
 * 获取当前等级 Credits 配额配置
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const service = new AdminConfigService(supabaseAdmin);
    const config = await service.getCurrentConfig();
    return NextResponse.json({ creditQuotas: config.creditQuotas });
  } catch (error: any) {
    return NextResponse.json({ error: '获取配额配置失败' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/config/quota
 * 更新等级 Credits 配额配置
 *
 * Body: { creditQuotas: AdminCreditConfig[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { creditQuotas } = body;

    if (!creditQuotas || !Array.isArray(creditQuotas)) {
      return NextResponse.json({ error: '配置值不合法，请检查输入' }, { status: 400 });
    }

    const service = new AdminConfigService(supabaseAdmin);
    await service.updateConfig({ creditQuotas }, admin.adminId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: '配置保存失败，请重试' }, { status: 500 });
  }
}
