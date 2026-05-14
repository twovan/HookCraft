import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';

/**
 * GET /api/batches/[id]
 *
 * 获取批次详情及关联的所有版本。
 * 包含认证校验和所有权验证。
 */
export async function GET(
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

    const { id: batchId } = await params;

    // Query batch with ownership validation
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('generation_batches')
      .select('*, templates(name)')
      .eq('id', batchId)
      .eq('user_id', user.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: '批次不存在或无权访问' },
        { status: 404 }
      );
    }

    // Query all related generation_tasks
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('generation_tasks')
      .select('*')
      .eq('batch_id', batchId)
      .order('version_number', { ascending: true });

    if (tasksError) {
      console.error('tasks query error:', tasksError);
      return NextResponse.json(
        { error: '查询版本详情失败' },
        { status: 500 }
      );
    }

    // Map response
    const batchSummary = {
      batchId: batch.id,
      createdAt: batch.created_at,
      templateName: (batch as any).templates?.name ?? null,
      promptSummary: batch.prompt ? batch.prompt.slice(0, 50) : null,
      generationType: batch.generation_type,
      versionCount: batch.version_count,
      selectedVersionId: batch.selected_task_id,
      status: batch.status,
    };

    // Generate signed URLs for audio files
    const versions = await Promise.all((tasks ?? []).map(async (task) => {
      let audioUrl: string | undefined;
      if (task.audio_path) {
        const { data: signedData } = await supabaseAdmin.storage
          .from('generations')
          .createSignedUrl(task.audio_path, 3600);
        audioUrl = signedData?.signedUrl;
      }
      return {
        taskId: task.id,
        versionNumber: task.version_number,
        status: task.status,
        audioUrl,
        lyrics: task.lyrics ?? undefined,
        durationSeconds: task.duration_seconds ?? undefined,
        creditsConsumed: task.credits_consumed,
        createdAt: task.created_at,
      };
    }));

    return NextResponse.json({
      batch: batchSummary,
      versions,
    });
  } catch (error: any) {
    console.error('batch detail error:', error);
    return NextResponse.json(
      { error: '获取批次详情失败' },
      { status: 500 }
    );
  }
}
