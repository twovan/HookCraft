import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../lib/supabase/auth-helpers';
import { KieSunoProvider } from '../../../../../lib/generation/KieSunoProvider';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { persistCompletedCoverTracks } from '../persist-tracks';

export const dynamic = 'force-dynamic';

const FAILED_STATUSES = new Set([
  'CREATE_TASK_FAILED',
  'GENERATE_AUDIO_FAILED',
  'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR',
]);

function getTrackAudioUrl(track: { audioUrl?: string; streamAudioUrl?: string }) {
  return track.audioUrl || track.streamAudioUrl || null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const localTaskId = searchParams.get('localTaskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
    }

    const provider = new KieSunoProvider();
    const details = await provider.getTaskDetails(taskId);
    const playableTracks = details.tracks.filter((track) => getTrackAudioUrl(track));
    const primaryTrack = playableTracks[0] || details.tracks[0] || null;
    const audioUrl = primaryTrack ? getTrackAudioUrl(primaryTrack) : null;
    const lyrics = primaryTrack?.prompt || null;
    const duration = primaryTrack?.duration || null;
    const failed = FAILED_STATUSES.has(details.status);

    if (localTaskId) {
      if (details.status === 'SUCCESS' && audioUrl) {
        await persistCompletedCoverTracks({
          localTaskId,
          userId: user.id,
          tracks: details.tracks,
        });
      } else if (failed) {
        const { data: task } = await supabaseAdmin
          .from('generation_tasks')
          .select('batch_id')
          .eq('id', localTaskId)
          .eq('user_id', user.id)
          .maybeSingle();

        await supabaseAdmin
          .from('generation_tasks')
          .update({
            status: 'failed',
            error_code: details.errorCode || details.status,
            error_message: details.errorMessage || '高级编曲生成失败',
            credits_consumed: 0,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', localTaskId)
          .eq('user_id', user.id);

        if (task?.batch_id) {
          await supabaseAdmin
            .from('generation_batches')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', task.batch_id)
            .eq('user_id', user.id);
        }
      }
    }

    return NextResponse.json({
      taskId: details.taskId,
      localTaskId,
      status: details.status,
      done: details.status === 'SUCCESS',
      failed,
      audioUrl,
      streamAudioUrl: primaryTrack?.streamAudioUrl || null,
      imageUrl: primaryTrack?.imageUrl || null,
      title: primaryTrack?.title || null,
      tags: primaryTrack?.tags || null,
      prompt: lyrics,
      lyrics,
      duration,
      tracks: playableTracks.length > 0 ? playableTracks : details.tracks,
      errorCode: details.errorCode,
      errorMessage: details.errorMessage,
    });
  } catch (error: any) {
    console.error('[kie/upload-cover/status] Error:', error);
    return NextResponse.json(
      { error: error?.message || '查询高级编曲状态失败' },
      { status: 500 }
    );
  }
}
