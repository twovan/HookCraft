import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * 浏览器端 Supabase 客户端
 * 使用 Anon Key，受 RLS 策略约束
 *
 * 如果环境变量未配置，客户端仍会创建但 API 调用会失败
 * 这样不会阻塞页面渲染（如 /demo 页面不需要 Supabase）
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
);

/** 检查 Supabase 是否已正确配置 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
