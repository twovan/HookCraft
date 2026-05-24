// GET /api/templates/purchased - 获取用户已购模板列表

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 查询 template_purchases JOIN templates
    const { data: purchases, error } = await supabaseAdmin
      .from('template_purchases')
      .select('template_id, purchased_at')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Purchased templates query error:', error);
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
    }

    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ templates: [] });
    }

    const templateIds = purchases.map((p) => p.template_id);

    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('templates')
      .select('id, name, genre, cover_url, category, producer_id')
      .in('id', templateIds)
      .eq('status', 'published');

    if (templatesError) {
      console.error('Templates query error:', templatesError);
      return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
    }

    // Merge purchased_at into template data
    const templateMap = new Map(
      (templates || []).map((t) => [t.id, t])
    );
    const producerIds = Array.from(new Set((templates || []).map((t: any) => t.producer_id).filter(Boolean))) as string[];
    let producerMap: Record<string, { name: string; avatarUrl?: string }> = {};

    if (producerIds.length > 0) {
      const { data: producers } = await supabaseAdmin
        .from('producers')
        .select('id, display_name, avatar_url')
        .in('id', producerIds);

      producerMap = (producers || []).reduce((acc: Record<string, { name: string; avatarUrl?: string }>, producer: any) => {
        acc[producer.id] = {
          name: producer.display_name,
          avatarUrl: producer.avatar_url || undefined,
        };
        return acc;
      }, {});
    }

    const result = purchases
      .map((p) => {
        const tmpl = templateMap.get(p.template_id);
        if (!tmpl) return null;
        return {
          id: tmpl.id,
          name: tmpl.name,
          genre: tmpl.genre,
          cover_url: tmpl.cover_url,
          category: tmpl.category,
          producer_id: (tmpl as any).producer_id,
          producer_name: (tmpl as any).producer_id ? producerMap[(tmpl as any).producer_id]?.name : undefined,
          producer_avatar_url: (tmpl as any).producer_id ? producerMap[(tmpl as any).producer_id]?.avatarUrl : undefined,
          purchased_at: p.purchased_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ templates: result });
  } catch (error) {
    console.error('Purchased templates error:', error);
    return NextResponse.json({ error: '系统错误，请稍后重试' }, { status: 500 });
  }
}
