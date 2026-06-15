import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { uploadTemplateAsset } from '../../../../lib/supabase/storage';
import { resolveActiveProducerId } from '../../../../lib/producer/resolveActiveProducerId';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
  TEMPLATE_ASSETS_BUCKET,
  TEMPLATE_COVER_IMAGE_MIME_TYPES,
  getPublicImageExtension,
  isPublicImageMimeType,
  uploadPublicImageAsset,
} from '@/lib/assets/publicAssetUpload.server';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only */ },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * POST /api/templates/upload
 * 制作人上传模板（需要登录）
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const producerId = await resolveActiveProducerId(supabaseAdmin, user.id);
    if (!producerId) {
      return NextResponse.json({ error: '请先完成制作人认证后再上传模板' }, { status: 403 });
    }

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const genre = formData.get('genre') as string;
    const category = (formData.get('category') as string) || 'paid_template';
    const priceStr = formData.get('price') as string;
    const price = parseInt(priceStr) || 0;
    const audioFile = formData.get('audio') as File | null;
    const coverFile = formData.get('cover') as File | null;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 });
    }
    if (!audioFile) {
      return NextResponse.json({ error: '请上传音频文件' }, { status: 400 });
    }

    // Validate audio
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/flac'];
    if (!validAudioTypes.includes(audioFile.type)) {
      return NextResponse.json({ error: '仅支持 MP3、WAV、OGG、FLAC 格式' }, { status: 400 });
    }
    if (audioFile.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '音频文件不能超过 20MB' }, { status: 400 });
    }

    // Create template record first
    const templateId = crypto.randomUUID();
    const { data: template, error: insertError } = await supabaseAdmin
      .from('templates')
      .insert({
        id: templateId,
        name: name.trim(),
        description: description || '',
        category: category as any,
        genre: genre || '',
        price,
        status: 'pending',
        producer_id: producerId,
        sales_count: 0,
      } as any)
      .select()
      .single();

    if (insertError) throw insertError;

    // Upload audio
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioExt = audioFile.name.split('.').pop() || 'mp3';
    const audioPath = await uploadTemplateAsset(templateId, 'reference-audio', audioBuffer, `preview.${audioExt}`);
    const { data: audioUrlData } = supabaseAdmin.storage.from('template-assets').getPublicUrl(audioPath);

    // Upload cover if provided
    let coverUrl: string | null = null;
    if (coverFile) {
      if (isPublicImageMimeType(coverFile.type, TEMPLATE_COVER_IMAGE_MIME_TYPES) && coverFile.size <= MAX_PUBLIC_IMAGE_UPLOAD_BYTES) {
        const asset = await uploadPublicImageAsset(coverFile, {
          bucket: TEMPLATE_ASSETS_BUCKET,
          path: `templates/${templateId}/cover/cover.${getPublicImageExtension(coverFile.type)}`,
          allowedMimeTypes: TEMPLATE_COVER_IMAGE_MIME_TYPES,
        });
        coverUrl = asset.publicUrl;
      }
    }

    // Update template with file URLs
    await supabaseAdmin
      .from('templates')
      .update({
        preview_url: audioUrlData.publicUrl,
        ...(coverUrl ? { cover_url: coverUrl } : {}),
      } as any)
      .eq('id', templateId);

    return NextResponse.json({
      success: true,
      template: { id: templateId, name: name.trim() },
      message: '模板已提交，等待管理员审核',
    });
  } catch (error) {
    console.error('[Template Upload Error]', error);
    return NextResponse.json({ error: '上传失败，请重试' }, { status: 500 });
  }
}
