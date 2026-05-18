import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase/server';

export const maxDuration = 60;

/**
 * POST /api/minimax/upload
 *
 * 接收音频文件（multipart/form-data），上传到 Supabase Storage，
 * 返回公开可访问的 URL。用于后续传给 MiniMax preprocess API。
 *
 * 这样做是为了绕过 Vercel serverless function 的 4.5MB JSON body 限制。
 * multipart/form-data 上传不受此限制。
 */
export async function POST(req: NextRequest) {
  try {
    // Step 1: 验证用户认证
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Step 2: 解析 FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '未找到音频文件' },
        { status: 400 }
      );
    }

    // Step 3: 校验文件类型和大小
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的音频格式，仅支持 MP3/WAV' },
        { status: 400 }
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过 50MB' },
        { status: 400 }
      );
    }

    // Step 4: 上传到 Supabase Storage
    const extension = file.name.split('.').pop() || 'mp3';
    const fileName = `${user.id}/preprocess/${Date.now()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('generations')
      .upload(fileName, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('[/api/minimax/upload] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: '音频上传失败，请重试' },
        { status: 500 }
      );
    }

    // Step 5: 获取公开 URL
    const { data: urlData } = supabaseAdmin.storage
      .from('generations')
      .getPublicUrl(data.path);

    return NextResponse.json({
      audioUrl: urlData.publicUrl,
      path: data.path,
    });
  } catch (error: any) {
    console.error('[/api/minimax/upload] Error:', error);
    return NextResponse.json(
      { error: `音频上传失败: ${error?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
