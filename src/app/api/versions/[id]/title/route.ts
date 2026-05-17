import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getAuthUser } from '../../../../../lib/supabase/auth-helpers';

/**
 * PUT /api/versions/[id]/title
 *
 * 更新歌曲标题。用户只能更新自己的歌曲。
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: '标题不能为空' },
        { status: 400 }
      );
    }

    if (title.trim().length > 50) {
      return NextResponse.json(
        { error: '标题不能超过50个字符' },
        { status: 400 }
      );
    }

    // Verify ownership: task must belong to the user
    const { data: task, error: taskError } = await supabaseAdmin
      .from('generation_tasks')
      .select('id, user_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    if (task.user_id !== user.id) {
      return NextResponse.json(
        { error: '无权修改此歌曲' },
        { status: 403 }
      );
    }

    // Update title
    const { error: updateError } = await supabaseAdmin
      .from('generation_tasks')
      .update({ title: title.trim() } as any)
      .eq('id', taskId);

    if (updateError) {
      console.error('update title error:', updateError);
      return NextResponse.json(
        { error: '更新标题失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error: any) {
    console.error('version title update error:', error);
    return NextResponse.json(
      { error: '更新标题失败' },
      { status: 500 }
    );
  }
}
