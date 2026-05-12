import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ producers: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: producers, error } = await supabase
      .from('producers')
      .select('id, display_name, avatar_url, style_tags')
      .eq('status', 'active')
      .eq('is_featured', true)
      .limit(6);

    if (error) {
      return NextResponse.json({ producers: [] });
    }

    // Get template counts for each producer
    const producerIds = (producers || []).map((p) => p.id);
    let templateCounts: Record<string, number> = {};

    if (producerIds.length > 0) {
      const { data: templates } = await supabase
        .from('templates')
        .select('producer_id')
        .in('producer_id', producerIds);

      if (templates) {
        templateCounts = templates.reduce((acc: Record<string, number>, t) => {
          if (t.producer_id) {
            acc[t.producer_id] = (acc[t.producer_id] || 0) + 1;
          }
          return acc;
        }, {});
      }
    }

    const result = (producers || []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      styleTags: p.style_tags || [],
      templateCount: templateCounts[p.id] || 0,
    }));

    return NextResponse.json({ producers: result });
  } catch {
    return NextResponse.json({ producers: [] });
  }
}
