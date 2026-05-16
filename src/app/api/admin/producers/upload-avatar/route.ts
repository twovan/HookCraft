import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/producers/upload-avatar
 * 上传制作人头像
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const producerId = formData.get('producerId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    if (!producerId) {
      return NextResponse.json({ error: '缺少制作人ID' }, { status: 400 });
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const hasBucket = buckets?.some(b => b.name === 'avatars');
    if (!hasBucket) {
      await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }

    // Upload file
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${producerId}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Avatar Upload] error:', uploadError.message);
      return NextResponse.json({ error: `上传失败: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (error: any) {
    console.error('[Avatar Upload Error]', error?.message || error);
    return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
  }
}
