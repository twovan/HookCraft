import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 受保护的路由前缀列表
 * 未认证用户访问这些路由将被重定向到 /login
 */
const PROTECTED_ROUTES = ['/studio', '/account', '/admin'];

/**
 * 创建 Supabase Auth 中间件
 * - 验证 JWT 令牌
 * - 自动刷新过期的会话令牌
 * - 保护 /studio、/account、/admin 路由
 * - 未认证用户重定向到 /login
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之间编写任何逻辑
  // 一个简单的错误可能导致用户被随机登出
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 检查当前路径是否为受保护路由
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // 未认证用户访问受保护路由时重定向到 /login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // 已认证用户访问 /login 时重定向到首页
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
