import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * POST /api/admin/templates/[id]/upload-url
 * 获取 Supabase Storage 签名上传 URL，前端直传文件绕过 Vercel 限制
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { fileName, fileIndex } = body;

    if (!fileName) {
      return NextResponse.json({ error: '缺少文件名' }, { status: 400 });
    }

    const ext = fileName.split('.').pop() || 'mp3';
    const storagePath = `${id}/reference-audio/ref-${fileIndex || 0}-${Date.now()}.${ext}`;

    // If this is the first file, clean up old reference audio files
    if (fileIndex === 0 || fileIndex === undefined) {
      const { data: existingFiles } = await supabaseAdmin.storage
        .from('template-assets')
        .list(`${id}/reference-audio`);

      if (existingFiles && existingFiles.length > 0) {
        const oldRefFiles = existingFiles
          .filter(f => f.name.startsWith('ref-'))
          .map(f => `${id}/reference-audio/${f.name}`);
        if (oldRefFiles.length > 0) {
          await supabaseAdmin.storage.from('template-assets').remove(oldRefFiles);
        }
      }
    }

    // Create a signed upload URL (valid for 10 minutes)
    const { data, error } = await supabaseAdmin.storage
      .from('template-assets')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('[Upload URL] error:', error.message);
      return NextResponse.json({ error: `获取上传链接失败: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: storagePath,
      token: data.token,
    });
  } catch (error: any) {
    console.error('[Upload URL Error]', error?.message || error);
    return NextResponse.json({ error: '获取上传链接失败' }, { status: 500 });
  }
}
