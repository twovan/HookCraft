import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/orders/export
 * 导出订单列表 CSV
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { data: orders, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) throw error;

    const headers = ['订单号', '用户ID', '等级', '计费周期', '金额(分)', '货币', '支付方式', '状态', '创建时间'];
    const rows = (orders || []).map((o: any) => [
      o.id.slice(0, 12).toUpperCase(),
      o.user_id || '',
      o.tier || '',
      o.billing_cycle || '',
      o.amount || 0,
      o.currency || 'cny',
      o.provider || '',
      o.status || '',
      o.created_at || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=orders_export.csv',
      },
    });
  } catch (error) {
    console.error('[Admin Orders Export Error]', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
