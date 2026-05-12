import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/logs/export
 * 导出操作日志 CSV
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || '';
    const operator = searchParams.get('operator') || '';

    let query = supabaseAdmin
      .from('operation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (type) {
      query = query.eq('operation_type', type);
    }
    if (operator) {
      query = query.ilike('operator_name', `%${operator}%`);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    const headers = ['时间', '操作人', '操作类型', '操作描述', '目标对象', 'IP地址'];
    const rows = (logs || []).map((log: any) => [
      log.created_at || '',
      log.operator_name || '',
      log.operation_type || '',
      log.operation_description || '',
      `${log.target_type || ''}:${log.target_id || ''}`,
      log.ip_address || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=operation_logs_export.csv',
      },
    });
  } catch (error) {
    console.error('[Admin Logs Export Error]', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
