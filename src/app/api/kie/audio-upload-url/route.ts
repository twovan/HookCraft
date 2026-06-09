import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import {
  ADVANCED_ARRANGEMENT_AUDIO_BUCKET,
  buildAdvancedArrangementStoragePath,
  validateAdvancedArrangementUploadMetadata,
} from '../../../../lib/kie/advancedArrangementUpload';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as {
      fileName?: string;
      contentType?: string;
      size?: number;
    } | null;

    const validation = validateAdvancedArrangementUploadMetadata({
      fileName: String(body?.fileName || ''),
      contentType: body?.contentType || '',
      size: Number(body?.size || 0),
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const path = buildAdvancedArrangementStoragePath({
      userId: user.id,
      fileName: body?.fileName || `reference.${validation.extension}`,
    });

    const { data, error } = await supabaseAdmin.storage
      .from(ADVANCED_ARRANGEMENT_AUDIO_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      console.error('[kie/audio-upload-url] Create signed upload URL failed:', error);
      return NextResponse.json({ error: '创建音频上传地址失败，请稍后重试' }, { status: 500 });
    }

    return NextResponse.json({
      bucket: ADVANCED_ARRANGEMENT_AUDIO_BUCKET,
      path: data.path || path,
      token: data.token,
    });
  } catch (error: any) {
    console.error('[kie/audio-upload-url] Error:', error);
    return NextResponse.json(
      { error: error?.message || '创建音频上传地址失败，请稍后重试' },
      { status: 500 }
    );
  }
}
