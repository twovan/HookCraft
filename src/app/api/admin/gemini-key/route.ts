import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/gemini-key
 * 仅管理员可获取 Gemini API Key（用于前端直接调用 Gemini 分析音频）
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 未配置' }, { status: 500 });
    }

    return NextResponse.json({ apiKey, key: apiKey });
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
