import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Supabase Admin Client（使用 Service Role Key）
 * 
 * 使用懒初始化模式，避免在 Next.js 构建阶段（Collecting page data）
 * 因环境变量未注入而抛出错误。
 */
let _supabaseAdmin: SupabaseClient<Database> | null = null;

export function isSupabaseAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('缺少环境变量: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('缺少环境变量: SUPABASE_SERVICE_ROLE_KEY');
  }

  _supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdmin;
}

/** Proxy 对象，访问时才真正初始化 Supabase client */
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export function createSupabaseRlsClient(accessToken?: string | null): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('缺少环境变量: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey) {
    throw new Error('缺少环境变量: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export function getServerSupabaseClient(accessToken?: string | null) {
  return isSupabaseAdminConfigured() ? supabaseAdmin : createSupabaseRlsClient(accessToken);
}
