import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

type UploadFileInput = {
  fileName: string;
  fileIndex: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const files: UploadFileInput[] = Array.isArray(body.files)
      ? body.files.map((file: any, index: number) => ({
          fileName: file.fileName || file.filename || file.name,
          fileIndex: typeof file.index === 'number' ? file.index : index,
        }))
      : [{
          fileName: body.fileName || body.filename || body.name,
          fileIndex: typeof body.fileIndex === 'number' ? body.fileIndex : 0,
        }];

    if (files.length === 0 || files.some((file) => !file.fileName)) {
      return NextResponse.json({ error: '缺少文件名' }, { status: 400 });
    }

    const { data: existingFiles } = await supabaseAdmin.storage
      .from('template-assets')
      .list(`${id}/reference-audio`);

    if (existingFiles && existingFiles.length > 0) {
      const oldRefFiles = existingFiles
        .filter((file) => file.name.startsWith('ref-'))
        .map((file) => `${id}/reference-audio/${file.name}`);
      if (oldRefFiles.length > 0) {
        await supabaseAdmin.storage.from('template-assets').remove(oldRefFiles);
      }
    }

    const timestamp = Date.now();
    const urls = [];
    for (const file of files) {
      const ext = file.fileName.split('.').pop() || 'mp3';
      const storagePath = `${id}/reference-audio/ref-${file.fileIndex}-${timestamp}-${file.fileIndex}.${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from('template-assets')
        .createSignedUploadUrl(storagePath);

      if (error) {
        console.error('[Upload URL] error:', error.message);
        return NextResponse.json({ error: `获取上传链接失败: ${error.message}` }, { status: 500 });
      }

      urls.push({
        signedUrl: data.signedUrl,
        url: data.signedUrl,
        path: storagePath,
        token: data.token,
      });
    }

    if (!Array.isArray(body.files)) {
      return NextResponse.json(urls[0]);
    }

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error('[Upload URL Error]', error?.message || error);
    return NextResponse.json({ error: '获取上传链接失败' }, { status: 500 });
  }
}
