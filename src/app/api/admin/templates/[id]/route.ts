import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';
import { TemplateAdminService } from '../../../../../lib/admin/TemplateAdminService';

/**
 * PUT /api/admin/templates/[id]
 * 更新模板信息
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { name, description, category, genre_tags, price } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 });
    }

    const updateData: { name: string; description: string; price: number; genre?: string } = {
      name: name.trim(),
      description: description || '',
      price: price || 0,
    };

    // genre_tags → 存到 genre 字段（TEXT，逗号分隔）
    if (genre_tags && Array.isArray(genre_tags)) {
      updateData.genre = genre_tags.join(', ');
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 });
      }
      console.error('[Admin Templates PUT DB Error]', error);
      return NextResponse.json({ error: `更新失败: ${error.message}` }, { status: 500 });
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `更新模板: ${name}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Templates PUT Error]', error);
    return NextResponse.json({ error: '更新模板失败，请重试' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/templates/[id]
 * 更新模板状态（发布/下架/审核通过/拒绝）
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const validStatuses = ['published', 'unpublished', 'pending', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: '无效的状态值' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('templates')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 });
      }
      throw error;
    }

    const statusLabels: Record<string, string> = {
      published: '上架',
      unpublished: '下架',
      pending: '设为待审核',
      rejected: '拒绝',
    };

    // Auto-trigger analysis when publishing a template with audio that hasn't been analyzed
    if (status === 'published' && data.preview_url && ['pending', 'failed'].includes(data.analysis_status)) {
      try {
        // Download audio from storage and trigger analysis
        const audioUrl = data.preview_url;
        const audioResponse = await fetch(audioUrl);
        if (audioResponse.ok) {
          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          const audioBase64 = audioBuffer.toString('base64');
          const mimeType = audioResponse.headers.get('content-type') || 'audio/mpeg';

          // Update status to analyzing
          await supabaseAdmin
            .from('templates')
            .update({ analysis_status: 'analyzing' })
            .eq('id', id);

          // Trigger async analysis
          const service = new TemplateAdminService(supabaseAdmin);
          service.analyzeTemplate(id, audioBase64, mimeType).catch((err) => {
            console.error(`[Auto Analysis on Publish] Template ${id} analysis failed:`, err);
          });
        }
      } catch (analysisErr) {
        console.error(`[Auto Analysis on Publish] Failed to fetch audio for template ${id}:`, analysisErr);
      }
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `${statusLabels[status] || status}模板: ${data.name}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Templates PATCH Error]', error);
    return NextResponse.json({ error: '操作失败，请重试' }, { status: 500 });
  }
}
