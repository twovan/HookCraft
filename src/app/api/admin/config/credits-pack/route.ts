import { NextRequest, NextResponse } from 'next/server';
import { AdminConfigService } from '../../../../../lib/admin/AdminConfigService';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getAuthUser, isAdmin } from '../../../../../lib/supabase/auth-helpers';

/**
 * GET /api/admin/config/credits-pack
 * 获取当前 Credits_Pack 配置
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: '无权访问，需要管理员权限' }, { status: 403 });
    }

    const service = new AdminConfigService(supabaseAdmin);
    const config = await service.getCurrentConfig();
    return NextResponse.json({ creditsPacks: config.creditsPacks });
  } catch (error: any) {
    return NextResponse.json({ error: '获取 Credits_Pack 配置失败' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/config/credits-pack
 * 更新 Credits_Pack 配置
 *
 * Body: { creditsPacks: CreditsPack[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: '无权访问，需要管理员权限' }, { status: 403 });
    }

    const body = await req.json();
    const { creditsPacks } = body;

    if (!creditsPacks || !Array.isArray(creditsPacks)) {
      return NextResponse.json({ error: '配置值不合法，请检查输入' }, { status: 400 });
    }

    const service = new AdminConfigService(supabaseAdmin);
    await service.updateConfig({ creditsPacks }, user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: '配置保存失败，请重试' }, { status: 500 });
  }
}
