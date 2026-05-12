/**
 * Admin Authentication Helper
 *
 * 独立的管理员认证系统，与前端 Supabase Auth 完全分离。
 * 使用 JWT + HttpOnly Cookie 实现管理员会话管理。
 */

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
if (!ADMIN_JWT_SECRET) {
  console.warn('[Admin Auth] ADMIN_JWT_SECRET 环境变量未设置，管理员认证将无法工作');
}
const JWT_SECRET = ADMIN_JWT_SECRET || 'hookcraft-admin-dev-only-secret';
const COOKIE_NAME = 'admin_session';

export interface AdminSession {
  adminId: string;
  username: string;
  role: string;
  displayName?: string;
}

interface AdminJwtPayload {
  adminId: string;
  username: string;
  role: string;
  displayName?: string;
  iat?: number;
  exp?: number;
}

/**
 * 验证管理员会话
 * 从请求 cookies 中读取 admin_session JWT 并验证
 *
 * @param request - NextRequest 对象（可选，不传则从 cookies() 读取）
 * @returns 管理员会话信息，未认证时返回 null
 */
export async function verifyAdminSession(
  request?: NextRequest
): Promise<AdminSession | null> {
  try {
    let token: string | undefined;

    if (request) {
      token = request.cookies.get(COOKIE_NAME)?.value;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const payload = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;

    return {
      adminId: payload.adminId,
      username: payload.username,
      role: payload.role,
      displayName: payload.displayName,
    };
  } catch {
    return null;
  }
}

/**
 * 创建管理员会话 JWT
 *
 * @param admin - 管理员信息
 * @param rememberMe - 是否记住登录状态（7天 vs 24小时）
 * @returns 签名的 JWT token
 */
export function createAdminSession(
  admin: { id: string; username: string; role: string; display_name?: string | null },
  rememberMe = false
): string {
  const expiresIn = rememberMe ? '7d' : '24h';

  return jwt.sign(
    {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      displayName: admin.display_name || admin.username,
    },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * 设置管理员会话 Cookie
 *
 * @param token - JWT token
 * @param rememberMe - 是否记住登录状态
 */
export function setAdminSessionCookie(token: string, rememberMe = false) {
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;

  // Return cookie options for use in Response headers
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * 清除管理员会话 Cookie
 *
 * @returns Cookie 配置用于清除
 */
export function clearAdminSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

/**
 * 要求管理员认证的辅助函数
 * 用于 API 路由中快速验证管理员身份
 *
 * @param request - NextRequest 对象
 * @returns { admin, response } - admin 为管理员会话信息，response 为错误响应（未认证时）
 */
export async function requireAdmin(
  request?: NextRequest
): Promise<{ admin: AdminSession; response?: never } | { admin?: never; response: NextResponse }> {
  const admin = await verifyAdminSession(request);
  if (!admin) {
    return {
      response: NextResponse.json(
        { error: '未登录或会话已过期，请重新登录' },
        { status: 401 }
      ),
    };
  }
  return { admin };
}
