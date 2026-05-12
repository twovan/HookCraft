/**
 * 带认证的 fetch 工具函数
 * 
 * 自动从 Supabase 客户端获取当前 session 的 access_token，
 * 并添加到请求的 Authorization header 中。
 * 
 * 用法：
 *   import { fetchWithAuth } from '@/lib/fetchWithAuth';
 *   const res = await fetchWithAuth('/api/membership/upgrade', { method: 'POST', body: ... });
 */

import { supabase } from './supabase/client';

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  // 如果没有设置 Content-Type 且 body 是字符串/对象，设置为 JSON
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
