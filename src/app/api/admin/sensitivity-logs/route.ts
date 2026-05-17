import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { SensitivityLogService } from '../../../../lib/sensitivity/SensitivityLogService';
import type { SensitivityResultType } from '@/types/sensitivity';

const logService = new SensitivityLogService(supabaseAdmin);

/**
 * GET /api/admin/sensitivity-logs
 * 获取敏感词检测日志列表（支持分页、按结果类型筛选）
 * Requirements: 8.8
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const resultType = searchParams.get('resultType') as SensitivityResultType | null;

    // 参数校验
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'page 参数不合法' }, { status: 400 });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'pageSize 参数不合法（1-100）' }, { status: 400 });
    }
    if (resultType && !['pass', 'rewrite', 'block'].includes(resultType)) {
      return NextResponse.json({ error: 'resultType 参数不合法' }, { status: 400 });
    }

    const logs = await logService.getLogs({
      page,
      pageSize,
      resultType: resultType || undefined,
    });

    return NextResponse.json({
      data: logs,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Admin Sensitivity Logs GET Error]', error);
    return NextResponse.json({ error: '获取检测日志失败' }, { status: 500 });
  }
}
