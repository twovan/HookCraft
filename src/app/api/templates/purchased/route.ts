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
      .select('id, name, genre, cover_url, category')
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
