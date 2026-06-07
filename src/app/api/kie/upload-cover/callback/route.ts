import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { getKieUserFacingErrorMessage } from '../../../../../lib/generation/KieSunoProvider';
import { persistCompletedCoverTracks } from '../persist-tracks';

export const dynamic = 'force-dynamic';

function findTracks(payload: any): any[] {
  const candidates = [
    payload?.data?.response?.sunoData,
    payload?.data?.sunoData,
    payload?.response?.sunoData,
    payload?.sunoData,
  ];

  const tracks = candidates.find(Array.isArray);
  return tracks || [];
}

export async function POST(req: NextRequest) {
  try {
    const localTaskId = req.nextUrl.searchParams.get('localTaskId');
    const payload = await req.json().catch(() => null);
    console.log('[kie/upload-cover/callback] Received:', payload);

    if (localTaskId && payload) {
      const status = payload?.data?.status || payload?.status;
      const tracks = findTracks(payload);
      const primaryTrack = tracks.find((track) => track.audioUrl || track.streamAudioUrl) || tracks[0] || null;
      const audioUrl = primaryTrack?.audioUrl || primaryTrack?.streamAudioUrl || null;

      const { data: task } = await supabaseAdmin
        .from('generation_tasks')
        .select('batch_id')
        .eq('id', localTaskId)
        .maybeSingle();

      if (status === 'SUCCESS' && audioUrl) {
        await persistCompletedCoverTracks({
          localTaskId,
          tracks,
        });
      } else if (typeof status === 'string' && status.includes('FAILED')) {
        await supabaseAdmin
          .from('generation_tasks')
          .update({
            status: 'failed',
            error_code: payload?.data?.errorCode || status,
            error_message: getKieUserFacingErrorMessage(payload?.data?.errorMessage || payload?.msg) || '高级编曲生成失败',
            credits_consumed: 0,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', localTaskId);

        if (task?.batch_id) {
          await supabaseAdmin
            .from('generation_batches')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', task.batch_id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[kie/upload-cover/callback] Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true });
}
