import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/config/cost-rules
 * 获取当前 Credits 消耗规则配置
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const service = new AdminConfigService(supabaseAdmin);
    const config = await service.getCurrentConfig();
    return NextResponse.json({ costRules: config.costRules });
  } catch (error: any) {
    return NextResponse.json({ error: '获取消耗规则配置失败' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/config/cost-rules
 * 更新 Credits 消耗规则配置
 *
 * Body: { costRules: AdminCostRule[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { costRules } = body;

    if (!costRules || !Array.isArray(costRules)) {
      return NextResponse.json({ error: '配置值不合法，请检查输入' }, { status: 400 });
    }

    const service = new AdminConfigService(supabaseAdmin);
    await service.updateConfig({ costRules }, admin.adminId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: '配置保存失败，请重试' }, { status: 500 });
  }
}
