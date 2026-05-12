import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/auth/logout
 * 管理员登出接口
 *
 * 清除 admin_session cookie
 */
export async function POST() {
  try {
    const cookie = clearAdminSessionCookie();

    const response = NextResponse.json({ success: true });

    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (error) {
    console.error('[Admin Logout Error]', error);
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    );
  }
}
