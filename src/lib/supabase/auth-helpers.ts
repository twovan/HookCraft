/**
 * API Route 认证辅助函数
 *
 * Supabase JS 客户端默认将 session 存储在 localStorage 中，
 * 服务端 API Route 无法直接读取。
 * 
 * 解决方案：前端 fetch 时在 header 中传递 access_token，
 * 服务端从 header 或 cookie 中提取并验证。
 */

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export async function getAuthAccessToken(): Promise<string | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieStore = await cookies();
  return cookieStore.get('sb-access-token')?.value ?? null;
}

/**
 * 从请求中提取认证用户
 * 
 * 优先级：
 * 1. Authorization header (Bearer token)
 * 2. Supabase cookie (如果存在)
 *
 * @returns 认证用户对象，未认证时返回 null
 */
export async function getAuthUser(): Promise<User | null> {
  try {
    // 方式 1: 从 Authorization header 读取 token
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) return user;
    }

    // 方式 2: 从自定义 sb-access-token cookie 读取
    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get('sb-access-token');
    if (accessTokenCookie?.value) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user }, error } = await supabase.auth.getUser(accessTokenCookie.value);
      if (user && !error) return user;
    }

    // 方式 3: 从 @supabase/ssr cookie 读取（标准方式）
    const supabaseSSR = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // 只读上下文中可能失败
            }
          },
        },
      }
    );

    const { data: { user } } = await supabaseSSR.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * 验证用户是否具有管理员角色
 */
export function isAdmin(user: User): boolean {
  return (
    user.app_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'admin'
  );
}
