// GET /api/templates/[id] - 获取单个模板详情（公开）

import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '../../../../lib/template/TemplateService';
import { supabaseAdmin } from '../../../../lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const templateService = new TemplateService(supabaseAdmin);
    const template = await templateService.getTemplateById(id);

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // Fetch producer info if template has producer_id
    let producerInfo: { id: string; name: string; avatarUrl?: string } | null = null;
    if ((template as any).producerId) {
      const { data: producer } = await supabaseAdmin
        .from('producers')
        .select('id, display_name, avatar_url')
        .eq('id', (template as any).producerId)
        .maybeSingle();
      if (producer) {
        producerInfo = { id: producer.id, name: producer.display_name, avatarUrl: producer.avatar_url || undefined };
      }
    }

    // Merge producer info into template response
    const templateResponse = {
      ...template,
      producerId: producerInfo?.id || (template as any).producerId,
      producerName: producerInfo?.name,
      producerAvatarUrl: producerInfo?.avatarUrl,
    };

    // Fetch related templates (same category, exclude current)
    const allTemplates = await templateService.getTemplates();
    const related = allTemplates
      .filter((t) => t.id !== id)
      .slice(0, 4);

    return NextResponse.json({ template: templateResponse, related });
  } catch (error: any) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { error: '获取模板详情失败，请稍后重试' },
      { status: 500 }
    );
  }
}
