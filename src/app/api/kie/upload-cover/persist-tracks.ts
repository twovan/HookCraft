import { supabaseAdmin } from '../../../../lib/supabase/server';
import type { KieSunoTrack } from '../../../../types/kie';

interface PersistCompletedCoverTracksParams {
  localTaskId: string;
  userId?: string;
  tracks: KieSunoTrack[];
}

function getTrackAudioUrl(track: KieSunoTrack) {
  return track.audioUrl || track.streamAudioUrl || null;
}

function getTrackDuration(track: KieSunoTrack) {
  const duration = Number(track.duration);
  return Number.isFinite(duration) ? Math.round(duration) : null;
}

function getProviderTaskId(rawAudioPath: string | null) {
  return rawAudioPath?.startsWith('kie:')
    ? rawAudioPath.slice('kie:'.length)
    : null;
}

function isMissingProviderColumnsError(error: unknown) {
  const value = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';

  return message.includes('provider_task_id') || message.includes('provider_audio_id');
}

export async function persistCompletedCoverTracks({
  localTaskId,
  userId,
  tracks,
}: PersistCompletedCoverTracksParams) {
  const completedTracks = tracks.filter((track) => getTrackAudioUrl(track));

  if (completedTracks.length === 0) {
    return { batchId: null, savedCount: 0 };
  }

  let taskQuery = supabaseAdmin
    .from('generation_tasks')
    .select('id,user_id,batch_id,prompt,title,raw_audio_path,model_id,generation_type,template_id,credits_consumed')
    .eq('id', localTaskId) as any;

  if (userId) {
    taskQuery = taskQuery.eq('user_id', userId);
  }

  const { data: baseTask, error: baseTaskError } = await taskQuery.maybeSingle();

  if (baseTaskError || !baseTask) {
    console.error('[kie/upload-cover] Base task lookup failed:', baseTaskError);
    return { batchId: null, savedCount: 0 };
  }

  const now = new Date().toISOString();
  const rows = completedTracks.map((track, index) => ({
    id: index === 0 ? localTaskId : `${localTaskId}-v${index + 1}`,
    user_id: baseTask.user_id,
    generation_type: baseTask.generation_type || 'full_demo',
    status: 'completed',
    prompt: track.prompt || baseTask.prompt,
    title: baseTask.title || track.title || null,
    template_id: baseTask.template_id || null,
    model_id: baseTask.model_id || 'kie-suno-v5_5',
    provider_task_id: getProviderTaskId(baseTask.raw_audio_path),
    provider_audio_id: track.id || null,
    audio_path: getTrackAudioUrl(track),
    raw_audio_path: baseTask.raw_audio_path,
    lyrics: track.prompt || null,
    song_structure: null,
    credits_consumed: index === 0 ? baseTask.credits_consumed || 0 : 0,
    batch_id: baseTask.batch_id,
    version_number: index + 1,
    duration_seconds: getTrackDuration(track),
    error_code: null,
    error_message: null,
    updated_at: now,
  }));

  let { error: upsertError } = await supabaseAdmin
    .from('generation_tasks')
    .upsert(rows as any, { onConflict: 'id' });

  if (isMissingProviderColumnsError(upsertError)) {
    const fallbackRows = rows.map(({ provider_task_id: _providerTaskId, provider_audio_id: _providerAudioId, ...row }) => row);
    const fallback = await supabaseAdmin
      .from('generation_tasks')
      .upsert(fallbackRows as any, { onConflict: 'id' });

    upsertError = fallback.error;
  }

  if (upsertError) {
    console.error('[kie/upload-cover] Persist completed tracks failed:', upsertError);
    return { batchId: baseTask.batch_id || null, savedCount: 0 };
  }

  if (baseTask.batch_id) {
    const { error: batchUpdateError } = await supabaseAdmin
      .from('generation_batches')
      .update({
        status: 'completed',
        selected_task_id: localTaskId,
        version_count: completedTracks.length,
        updated_at: now,
      } as any)
      .eq('id', baseTask.batch_id)
      .eq('user_id', baseTask.user_id);

    if (batchUpdateError) {
      console.error('[kie/upload-cover] Persist completed batch failed:', batchUpdateError);
    }
  }

  return { batchId: baseTask.batch_id || null, savedCount: completedTracks.length };
}
