import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * GET /api/admin/templates/[id]/analysis-status
 * 获取模板分析状态（用于前端轮询）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('analysis_status, analysis_result, lyria_prompt, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // Check for timeout: if analyzing for more than 2 minutes
    let timedOut = false;
    if (data.analysis_status === 'analyzing' && data.updated_at) {
      const updatedAt = new Date(data.updated_at).getTime();
      const now = Date.now();
      const elapsed = now - updatedAt;
      if (elapsed > 2 * 60 * 1000) { // 2 minutes
        timedOut = true;
        // Auto-mark as failed
        await supabaseAdmin
          .from('templates')
          .update({
            analysis_status: 'failed',
            analysis_result: '分析超时：Gemini API 响应超过2分钟，请重试或检查音频文件',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', id);
      }
    }

    return NextResponse.json({
      status: timedOut ? 'failed' : data.analysis_status,
      result: timedOut ? '分析超时：Gemini API 响应超过2分钟，请重试或检查音频文件' : (data.analysis_result || null),
      lyriaPrompt: data.lyria_prompt || null,
      timedOut,
    });
  } catch (error) {
    console.error('[Analysis Status Error]', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
