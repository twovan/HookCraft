import type { SupabaseClient } from '@supabase/supabase-js';
import { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import type { Database } from '@/lib/supabase/types';
import type { KieSunoTrack } from '@/types/kie';

export interface KieStemSource {
  generationTaskId: string;
  sourceTaskId: string;
  sourceAudioId: string;
  audioUrl: string | null;
}

interface GenerationTaskRecord {
  id: string;
  user_id: string;
  status: string;
  model_id: string;
  audio_path: string | null;
  raw_audio_path: string | null;
  version_number: number | null;
  provider_task_id: string | null;
  provider_audio_id: string | null;
}

function parseKieTaskId(rawAudioPath: string | null) {
  return rawAudioPath?.startsWith('kie:')
    ? rawAudioPath.slice('kie:'.length)
    : null;
}

function getTrackAudioUrl(track: KieSunoTrack) {
  return track.audioUrl || track.streamAudioUrl || null;
}

function findTrackForTask(task: GenerationTaskRecord, tracks: KieSunoTrack[]) {
  if (task.audio_path) {
    const audioPathMatch = tracks.find((track) => getTrackAudioUrl(track) === task.audio_path);
    if (audioPathMatch) return audioPathMatch;
  }

  const versionIndex = typeof task.version_number === 'number'
    ? task.version_number - 1
    : 0;

  return tracks[versionIndex] || tracks[0] || null;
}

function isMissingProviderColumnsError(error: unknown) {
  const value = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';

  return message.includes('provider_task_id') || message.includes('provider_audio_id');
}

export async function resolveKieStemSource(
  supabase: SupabaseClient<Database>,
  generationTaskId: string,
  userId: string,
  provider = new KieSunoProvider(),
): Promise<KieStemSource> {
  let supportsProviderColumns = true;
  let { data, error } = await supabase
    .from('generation_tasks')
    .select('id,user_id,status,model_id,audio_path,raw_audio_path,version_number,provider_task_id,provider_audio_id')
    .eq('id', generationTaskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (isMissingProviderColumnsError(error)) {
    supportsProviderColumns = false;
    const fallback = await supabase
      .from('generation_tasks')
      .select('id,user_id,status,model_id,audio_path,raw_audio_path,version_number')
      .eq('id', generationTaskId)
      .eq('user_id', userId)
      .maybeSingle();

    data = fallback.data
      ? { ...fallback.data, provider_task_id: null, provider_audio_id: null }
      : null;
    error = fallback.error;
  }

  if (error) throw error;
  if (!data) throw new Error('Generation result not found');

  const task = data as GenerationTaskRecord;
  if (task.status !== 'completed') {
    throw new Error('Only completed generation results can be split');
  }

  if (!task.model_id.includes('kie')) {
    throw new Error('This generation result is not backed by KIE stems');
  }

  const sourceTaskId = task.provider_task_id || parseKieTaskId(task.raw_audio_path);
  if (!sourceTaskId) {
    throw new Error('Missing KIE source task id for stem splitting');
  }

  if (task.provider_audio_id) {
    return {
      generationTaskId: task.id,
      sourceTaskId,
      sourceAudioId: task.provider_audio_id,
      audioUrl: task.audio_path,
    };
  }

  const details = await provider.getTaskDetails(sourceTaskId);
  const track = findTrackForTask(task, details.tracks);
  if (!track?.id) {
    throw new Error('Missing KIE audio id for stem splitting');
  }

  if (supportsProviderColumns) {
    const { error: updateError } = await supabase
      .from('generation_tasks')
      .update({
        provider_task_id: sourceTaskId,
        provider_audio_id: track.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[stems] Failed to backfill KIE source ids:', updateError);
    }
  }

  return {
    generationTaskId: task.id,
    sourceTaskId,
    sourceAudioId: track.id,
    audioUrl: task.audio_path,
  };
}
