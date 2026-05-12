import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/auth/session
 * 检查管理员会话状态
 *
 * 用于前端页面检查是否已登录
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdminSession(request);

    if (!admin) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
  } catch {
    return NextResponse.json({ error: '会话验证失败' }, { status: 401 });
  }
}
