import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/orders/[id]
 * 获取订单详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    const { data: order, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // Get related payment session if exists
    let session = null;
    if (order.session_id) {
      const { data: sessionData } = await supabaseAdmin
        .from('payment_sessions')
        .select('*')
        .eq('id', order.session_id)
        .single();
      session = sessionData;
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.id.slice(0, 12).toUpperCase(),
        userId: order.user_id,
        type: order.tier === 'free' ? 'credits_pack' : 'membership',
        productName: `${order.tier} ${order.billing_cycle || ''}`.trim(),
        amount: order.amount,
        paymentMethod: order.provider,
        status: order.status,
        currency: order.currency,
        createdAt: order.created_at,
        completedAt: order.completed_at,
      },
      session: session || null,
    });
  } catch (error) {
    console.error('[Admin Order Detail Error]', error);
    return NextResponse.json({ error: '获取订单详情失败' }, { status: 500 });
  }
}
