import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * POST /api/admin/templates/[id]/save-analysis
 * 保存前端 Gemini 分析结果到数据库
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { analysisResult, lyriaPrompt, status, error: errorMsg } = body;

    if (status === 'failed') {
      await supabaseAdmin.from('templates').update({
        analysis_status: 'failed',
        analysis_result: `分析失败: ${errorMsg || '未知错误'}`,
        updated_at: new Date().toISOString(),
      } as any).eq('id', id);
      return NextResponse.json({ success: true, status: 'failed' });
    }

    await supabaseAdmin.from('templates').update({
      analysis_result: analysisResult || '',
      lyria_prompt: lyriaPrompt || '',
      analysis_status: 'completed',
      updated_at: new Date().toISOString(),
    } as any).eq('id', id);

    // Log
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `模板分析完成 (前端): ${id}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ success: true, status: 'completed' });
  } catch (error: any) {
    console.error('[Save Analysis Error]', error?.message || error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
