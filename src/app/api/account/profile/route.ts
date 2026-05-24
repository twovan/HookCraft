import { NextRequest, NextResponse } from 'next/server';
import { buildProfileMetadata, hasUsernameConflict, validateUsername } from '@/lib/account/profile';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (error || !data.user) {
    return NextResponse.json({ error: '获取个人信息失败' }, { status: 500 });
  }

  const latestUser = data.user;

  return NextResponse.json({
    email: latestUser.email ?? '',
    username: latestUser.user_metadata?.username ?? latestUser.user_metadata?.display_name ?? '',
    avatarUrl: latestUser.user_metadata?.avatar_url ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const validation = validateUsername(String(body.username ?? ''));

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let usernameTaken = false;
  try {
    usernameTaken = await hasUsernameConflict(
      (params) => supabaseAdmin.auth.admin.listUsers(params),
      validation.value,
      user.id,
    );
  } catch {
    return NextResponse.json({ error: '检查用户名失败，请稍后重试' }, { status: 500 });
  }

  if (usernameTaken) {
    return NextResponse.json({ error: '用户名已被使用' }, { status: 409 });
  }

  const { data: latestData, error: latestError } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (latestError || !latestData.user) {
    return NextResponse.json({ error: '获取个人信息失败' }, { status: 500 });
  }

  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : undefined;

  const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: buildProfileMetadata(latestData.user.user_metadata ?? {}, {
        username: validation.value,
        avatarUrl,
      }),
    },
  );

  if (updateError) {
    return NextResponse.json({ error: '保存个人信息失败，请稍后重试' }, { status: 500 });
  }

  return NextResponse.json({
    email: updated.user.email ?? '',
    username: updated.user.user_metadata?.username ?? validation.value,
    avatarUrl: updated.user.user_metadata?.avatar_url ?? null,
  });
}
