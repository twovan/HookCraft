/**
 * API Route 认证辅助函数
 *
 * 提供从请求 cookies 中提取认证用户的工具函数，
 * 用于 API Routes 中验证用户身份。
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

/**
 * 从请求 cookies 中提取认证用户
 * 使用 @supabase/ssr 的 createServerClient 读取 cookies 中的会话信息
 *
 * @returns 认证用户对象，未认证时返回 null
 */
export async function getAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
            // setAll 在 Server Component 中可能会失败（只读 cookies）
            // 在 API Route 中通常不会失败
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 验证用户是否具有管理员角色
 * 检查 JWT 中的 app_metadata.role 或 user_metadata.role
 *
 * @param user - Supabase 用户对象
 * @returns 是否为管理员
 */
export function isAdmin(user: User): boolean {
  return (
    user.app_metadata?.role === 'admin' ||
    user.user_metadata?.role === 'admin'
  );
}
