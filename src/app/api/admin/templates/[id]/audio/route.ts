import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import { uploadTemplateAsset } from '../../../../../../lib/supabase/storage';
import { TemplateAdminService } from '../../../../../../lib/admin/TemplateAdminService';

// Allow up to 20MB uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/admin/templates/[id]/audio
 * 上传模板参考音频
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请选择音频文件' }, { status: 400 });
    }

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/flac'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '仅支持 MP3、WAV、OGG、FLAC 格式' }, { status: 400 });
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '音频文件不能超过 20MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'mp3';
    const filename = `preview.${ext}`;

    const path = await uploadTemplateAsset(id, 'reference-audio', buffer, filename);

    // Build public URL for the audio
    const { data: urlData } = supabaseAdmin.storage
      .from('template-assets')
      .getPublicUrl(path);

    const previewUrl = urlData.publicUrl;

    // Update template with preview URL and set analysis_status to analyzing
    const { error: updateError } = await supabaseAdmin
      .from('templates')
      .update({ preview_url: previewUrl, analysis_status: 'analyzing' } as any)
      .eq('id', id);

    if (updateError) throw updateError;

    // Trigger async analysis (don't await - let it run in background)
    const audioBase64 = buffer.toString('base64');
    const mimeType = file.type || 'audio/mpeg';
    const service = new TemplateAdminService(supabaseAdmin);
    service.analyzeTemplate(id, audioBase64, mimeType).catch((err) => {
      console.error(`[Auto Analysis] Template ${id} analysis failed:`, err);
    });

    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `上传模板音频: ${id}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ previewUrl, success: true });
  } catch (error) {
    console.error('[Admin Template Audio Upload Error]', error);
    return NextResponse.json({ error: '音频上传失败，请重试' }, { status: 500 });
  }
}
