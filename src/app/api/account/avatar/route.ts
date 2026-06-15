import { NextRequest, NextResponse } from 'next/server';
import { validateAvatarFile } from '@/lib/account/profile';
import {
  AVATAR_ASSETS_BUCKET,
  getPublicImageExtension,
  uploadPublicImageAsset,
} from '@/lib/assets/publicAssetUpload.server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

  let avatarUrl: string;
  try {
    const asset = await uploadPublicImageAsset(file, {
      bucket: AVATAR_ASSETS_BUCKET,
      path: `${user.id}/avatar.${getPublicImageExtension(file.type)}`,
      maxBytes: 2 * 1024 * 1024,
    });
    avatarUrl = asset.publicUrl;
  } catch {
    return NextResponse.json({ error: '头像上传失败，请稍后重试' }, { status: 500 });
  }
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
