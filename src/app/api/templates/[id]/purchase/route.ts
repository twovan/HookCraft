// POST /api/templates/[id]/purchase - 购买单个模板

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;

    // 查询模板信息和价格
    const { data: template, error: templateError } = await supabaseAdmin
      .from('templates')
      .select('id, name, price, category')
      .eq('id', id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 检查是否已购买
    const { data: existing } = await supabaseAdmin
      .from('template_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('template_id', id)
      .single();

    if (existing) {
      return NextResponse.json({ error: '该模板已购买' }, { status: 409 });
    }

    const orderId = randomUUID();
    const purchasePrice = template.price || 0;

    // 写入 template_purchases
    const { error: insertError } = await supabaseAdmin
      .from('template_purchases')
      .insert({
        user_id: user.id,
        template_id: id,
        purchase_price: purchasePrice,
        order_id: orderId,
      });

    if (insertError) {
      console.error('Purchase insert error:', insertError);
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
    }

    // 写入 payments 记录
    await supabaseAdmin.from('payments').insert({
      id: randomUUID(),
      user_id: user.id,
      amount: purchasePrice,
      currency: 'CNY',
      provider: 'alipay',
      tier: 'free',
      billing_cycle: 'monthly',
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // 更新 sales_count
    const { data: currentTemplate } = await supabaseAdmin
      .from('templates')
      .select('sales_count')
      .eq('id', id)
      .single();

    if (currentTemplate) {
      await supabaseAdmin
        .from('templates')
        .update({ sales_count: (currentTemplate.sales_count || 0) + 1 })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      purchase_id: orderId,
      template_id: id,
      price: purchasePrice,
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
  }
}
