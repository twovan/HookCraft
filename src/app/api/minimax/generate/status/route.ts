import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getAuthUser } from '../../../../../lib/supabase/auth-helpers';

/**
 * GET /api/minimax/generate/status?taskId=xxx
 *
 * 查询编曲生成任务状态（轮询端点）
 * 
 * 返回：
 * - status: 'pending' | 'generating' | 'completed' | 'failed'
 * - audioUrl: 生成完成时的音频 URL
 * - error: 失败时的错误信息
 */
export async function GET(req: NextRequest) {
  try {
    // 认证检查
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // 获取 taskId 参数
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    // 查询任务状态（使用 admin 客户端绕过 RLS，但验证 user_id）
    const { data: task, error } = await supabaseAdmin
      .from('generation_tasks')
      .select('id, status, audio_path, lyrics, error_code, error_message, updated_at')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (error || !task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    // 根据状态返回不同的响应
    const response: Record<string, unknown> = {
      taskId: task.id,
      status: task.status,
    };

    if (task.status === 'completed') {
      response.audioUrl = task.audio_path;
      response.lyrics = task.lyrics;
    }

    if (task.status === 'failed') {
      response.error = task.error_message || '生成失败';
      response.errorCode = task.error_code;
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[minimax/generate/status] 查询失败:', error);
    return NextResponse.json(
      { error: '查询任务状态失败' },
      { status: 500 }
    );
  }
}
