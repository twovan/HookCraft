import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/settings
 * 获取所有平台设置
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { data: settings, error } = await supabaseAdmin
      .from('platform_settings')
      .select('*');

    if (error) throw error;

    // Build settings object from rows
    const settingsMap: Record<string, any> = {};
    (settings || []).forEach((s: any) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    // Default values if not set
    const result = {
      basic: settingsMap.basic || {
        platformName: 'HookCraft',
        platformDescription: 'AI 音乐创作平台',
        contactEmail: 'support@hookcraft.com',
        icpNumber: '',
      },
      transaction: settingsMap.transaction || {
        commissionRate: 30,
        minWithdrawalAmount: 100,
        settlementCycleDays: 30,
        enabledPaymentMethods: ['wechat', 'alipay', 'stripe'],
      },
      aiGeneration: settingsMap.ai_generation || {
        modelVersion: 'v2.0',
        maxConcurrentGenerations: 10,
        generationTimeoutSeconds: 300,
        creditsResetSchedule: '每月1日 00:00',
      },
      review: settingsMap.review || {
        trustedProducerAutoApprove: false,
        aiContentSafetyPreCheck: true,
        reviewTimeoutReminderHours: 24,
        notificationMethods: ['in_app', 'email'],
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Admin Settings GET Error]', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * 更新设置
 */
export async function PUT(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { section, value } = body;

    if (!section || !value) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const validSections = ['basic', 'transaction', 'ai_generation', 'review'];
    if (!validSections.includes(section)) {
      return NextResponse.json({ error: '无效的设置分类' }, { status: 400 });
    }

    // Upsert the setting
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        setting_key: section,
        setting_value: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });

    if (error) throw error;

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'system',
      operation_description: `更新平台设置: ${section}`,
      target_type: 'platform_settings',
      target_id: section,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Settings PUT Error]', error);
    return NextResponse.json({ error: '保存设置失败' }, { status: 500 });
  }
}
