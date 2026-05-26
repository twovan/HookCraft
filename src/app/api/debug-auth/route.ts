// DEBUG: 临时调试 API，用于检查 auth cookie 状态
// 部署后访问 /api/debug-auth 查看结果

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/supabase/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // 列出所有 cookie 名称（不暴露值）
    const cookieNames = allCookies.map(c => ({
      name: c.name,
      valueLength: c.value.length,
      isSb: c.name.startsWith('sb-'),
    }));

    // 使用 getAuthUser 函数测试
    const user = await getAuthUser();

    return NextResponse.json({
      cookieCount: allCookies.length,
      sbCookies: cookieNames.filter(c => c.isSb),
      allCookieNames: cookieNames.map(c => c.name),
      userFound: !!user,
      userId: user?.id?.slice(0, 8) || null,
      userEmail: user?.email || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
