import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body as { items: Array<{ template_id: string }> };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '购物车为空' }, { status: 400 });
    }

    const templateIds = items.map((i) => i.template_id);

    // Query all templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('templates')
      .select('id, name, price')
      .in('id', templateIds);

    if (templatesError || !templates) {
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
    }

    // Check already purchased
    const { data: existingPurchases } = await supabaseAdmin
      .from('template_purchases')
      .select('template_id')
      .eq('user_id', user.id)
      .in('template_id', templateIds);

    const purchasedSet = new Set(
      (existingPurchases || []).map((p) => p.template_id)
    );

    const orderId = randomUUID();
    const purchased: Array<{ template_id: string; name: string; price: number }> = [];
    const skipped: Array<{ template_id: string; name: string; reason: string }> = [];

    for (const tmpl of templates) {
      if (purchasedSet.has(tmpl.id)) {
        skipped.push({
          template_id: tmpl.id,
          name: tmpl.name,
          reason: '已购买，已跳过',
        });
      } else {
        purchased.push({
          template_id: tmpl.id,
          name: tmpl.name,
          price: tmpl.price || 0,
        });
      }
    }

    // Batch insert template_purchases for new purchases
    if (purchased.length > 0) {
      const purchaseRecords = purchased.map((p) => ({
        user_id: user.id,
        template_id: p.template_id,
        purchase_price: p.price,
        order_id: orderId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('template_purchases')
        .insert(purchaseRecords);

      if (insertError) {
        console.error('Checkout insert error:', insertError);
        return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
      }
    }

    const totalAmount = purchased.reduce((sum, p) => sum + p.price, 0);

    // Insert payments record
    if (totalAmount > 0) {
      await supabaseAdmin.from('payments').insert({
        id: randomUUID(),
        user_id: user.id,
        amount: totalAmount,
        currency: 'CNY',
        provider: 'alipay',
        tier: 'free',
        billing_cycle: 'monthly',
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      total_amount: totalAmount,
      purchased,
      skipped,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
  }
}
