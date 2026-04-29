import { supabase } from './client';

/**
 * 退出登录
 * 清除客户端会话令牌并重定向到登录页面
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // 重定向到登录页面
  window.location.href = '/login';
}

/**
 * 获取当前会话
 * 自动刷新过期的 JWT 令牌
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('获取会话失败:', error.message);
    return null;
  }
  return session;
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('获取用户信息失败:', error.message);
    return null;
  }
  return user;
}

/**
 * 监听认证状态变化
 * 用于在布局组件中监听登录/登出事件
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}
