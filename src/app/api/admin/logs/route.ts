import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/logs
 * 获取操作日志列表（分页、可筛选）
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const type = searchParams.get('type') || '';
    const operator = searchParams.get('operator') || '';

    // Build query
    let query = supabaseAdmin
      .from('operation_logs')
      .select('*', { count: 'exact' });

    if (type) {
      query = query.eq('operation_type', type);
    }
    if (operator) {
      query = query.ilike('operator_name', `%${operator}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      data: (logs || []).map((log: any) => ({
        id: log.id,
        operatorName: log.operator_name,
        operationType: log.operation_type,
        operationDescription: log.operation_description,
        targetType: log.target_type,
        targetId: log.target_id,
        ipAddress: log.ip_address,
        createdAt: log.created_at,
      })),
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Admin Logs GET Error]', error);
    return NextResponse.json({ error: '获取日志列表失败' }, { status: 500 });
  }
}
