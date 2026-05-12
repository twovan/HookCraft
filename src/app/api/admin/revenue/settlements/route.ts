import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/revenue/settlements
 * 获取结算记录列表
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabaseAdmin
      .from('settlements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      data: (data || []).map((s: any) => ({
        id: s.id,
        settlementNumber: s.settlement_number,
        producerName: s.producer_name,
        producerId: s.producer_id,
        templateSalesAmount: s.template_sales_amount,
        platformCommission: s.platform_commission,
        settlementAmount: s.settlement_amount,
        status: s.status,
        settlementDate: s.settlement_date,
        paidAt: s.paid_at,
      })),
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Admin Settlements GET Error]', error);
    return NextResponse.json({ error: '获取结算记录失败' }, { status: 500 });
  }
}

/**
 * POST /api/admin/revenue/settlements
 * 创建新结算记录
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { producerId, producerName, templateSalesAmount, platformCommission, settlementAmount } = body;

    if (!producerId || !producerName) {
      return NextResponse.json({ error: '制作人信息为必填项' }, { status: 400 });
    }

    const settlementNumber = `STL-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabaseAdmin
      .from('settlements')
      .insert({
        settlement_number: settlementNumber,
        producer_id: producerId,
        producer_name: producerName,
        template_sales_amount: templateSalesAmount || 0,
        platform_commission: platformCommission || 0,
        settlement_amount: settlementAmount || 0,
        status: 'processing',
      })
      .select()
      .single();

    if (error) throw error;

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'transaction',
      operation_description: `发起结算: ${settlementNumber} - ${producerName}`,
      target_type: 'settlement',
      target_id: data.id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Settlement POST Error]', error);
    return NextResponse.json({ error: '创建结算失败' }, { status: 500 });
  }
}
