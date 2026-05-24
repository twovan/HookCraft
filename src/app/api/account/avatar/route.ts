import { NextRequest, NextResponse } from 'next/server';
import { validateAvatarFile } from '@/lib/account/profile';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

const AVATAR_BUCKET = 'avatars';

function getExtension(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

async function ensureAvatarBucket() {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(AVATAR_BUCKET);
  if (bucket) return;

  await supabaseAdmin.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('avatar');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请选择头像图片' }, { status: 400 });
  }

  const validation = validateAvatarFile({ type: file.type, size: file.size });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  await ensureAvatarBucket();

  const extension = getExtension(file.type);
  const path = `${user.id}/avatar.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: '头像上传失败，请稍后重试' }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  const { data: latestData, error: latestError } = await supabaseAdmin.auth.admin.getUserById(user.id);

  if (latestError || !latestData.user) {
    return NextResponse.json({ error: '头像已上传，但获取资料失败' }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...latestData.user.user_metadata,
        avatar_url: avatarUrl,
      },
    },
  );

  if (updateError) {
    return NextResponse.json({ error: '头像已上传，但保存资料失败' }, { status: 500 });
  }

  return NextResponse.json({
    avatarUrl: updated.user.user_metadata?.avatar_url ?? avatarUrl,
  });
}
