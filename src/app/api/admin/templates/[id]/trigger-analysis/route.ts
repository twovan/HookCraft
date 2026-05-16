import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * POST /api/admin/templates/[id]/trigger-analysis
 * 准备分析：设置 preview URL 和 analyzing 状态
 * 实际的 Gemini 调用由前端完成（绕过 Vercel 10s 限制）
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    // List reference audio files
    const { data: files } = await supabaseAdmin.storage
      .from('template-assets')
      .list(`${id}/reference-audio`);

    const refFiles = (files || [])
      .filter(f => f.name.startsWith('ref-'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (refFiles.length === 0) {
      return NextResponse.json({ error: '未找到已上传的音频文件' }, { status: 400 });
    }

    // Set first file as preview URL
    const firstFilePath = `${id}/reference-audio/${refFiles[0].name}`;
    const { data: urlData } = supabaseAdmin.storage
      .from('template-assets')
      .getPublicUrl(firstFilePath);

    await supabaseAdmin
      .from('templates')
      .update({ preview_url: urlData.publicUrl, analysis_status: 'analyzing' } as any)
      .eq('id', id);

    // Return download URLs for all reference files (frontend will download and send to Gemini)
    const audioUrls = refFiles.map(f => {
      const { data } = supabaseAdmin.storage
        .from('template-assets')
        .getPublicUrl(`${id}/reference-audio/${f.name}`);
      return { name: f.name, url: data.publicUrl };
    });

    return NextResponse.json({
      success: true,
      previewUrl: urlData.publicUrl,
      audioUrls,
      filesCount: refFiles.length,
    });
  } catch (error: any) {
    console.error('[Trigger Analysis Error]', error?.message || error);
    return NextResponse.json({ error: '准备分析失败' }, { status: 500 });
  }
}
