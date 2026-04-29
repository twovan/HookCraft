import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 匹配所有受保护路由及登录页面：
     * - /studio 及其子路由
     * - /account 及其子路由
     * - /admin 及其子路由
     * - /login（已登录用户重定向）
     *
     * 排除静态资源和 API 路由中不需要认证的路径
     */
    '/studio/:path*',
    '/account/:path*',
    '/admin/:path*',
    '/login',
  ],
};
