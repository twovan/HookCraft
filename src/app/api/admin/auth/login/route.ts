import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { createAdminSession, setAdminSessionCookie } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/auth/login
 * 管理员登录接口
 *
 * 使用独立的 admin_accounts 表验证，与 Supabase Auth 完全分离
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, rememberMe } = body;

    // 参数验证
    if (!username || !password) {
      return NextResponse.json(
        { error: '请输入用户名和密码' },
        { status: 400 }
      );
    }

    // 查询管理员账户
    const { data: admin, error } = await supabaseAdmin
      .from('admin_accounts')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 更新最后登录时间
    await supabaseAdmin
      .from('admin_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);

    // 创建 JWT token
    const token = createAdminSession(admin, rememberMe === true);
    const cookie = setAdminSessionCookie(token, rememberMe === true);

    // 设置 HttpOnly cookie 并返回成功响应
    const response = NextResponse.json({
      success: true,
      admin: {
        username: admin.username,
        displayName: admin.display_name || admin.username,
        role: admin.role,
      },
    });

    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (error) {
    console.error('[Admin Login Error]', error);
    return NextResponse.json(
      { error: '登录失败，请重试' },
      { status: 500 }
    );
  }
}
