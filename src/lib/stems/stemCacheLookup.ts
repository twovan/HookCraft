import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

interface StemCacheTask {
  id: string;
  raw_audio_path?: string | null;
  provider_task_id?: string | null;
  provider_audio_id?: string | null;
}

interface StemJobRow {
  id: string;
  source_generation_task_id: string;
  source_provider_task_id: string | null;
  source_provider_audio_id: string | null;
}

export interface StemCacheSummary {
  jobId: string;
  hasStemCache: boolean;
}

function parseKieTaskId(rawAudioPath?: string | null) {
  return rawAudioPath?.startsWith('kie:')
    ? rawAudioPath.slice('kie:'.length)
    : null;
}

function getProviderTaskId(task: StemCacheTask) {
  return task.provider_task_id || parseKieTaskId(task.raw_audio_path);
}

function setCacheOnce(
  cacheByTaskId: Map<string, StemCacheSummary>,
  taskId: string | undefined,
  jobId: string,
) {
  if (!taskId || cacheByTaskId.has(taskId)) return;
  cacheByTaskId.set(taskId, {
    jobId,
    hasStemCache: true,
  });
}

function applyStemJobMatches(
  cacheByTaskId: Map<string, StemCacheSummary>,
  taskIdSet: Set<string>,
  taskIdByProviderAudio: Map<string, string>,
  uniqueTaskIdByProviderTask: Map<string, string>,
  jobs: StemJobRow[],
) {
  for (const job of jobs) {
    if (taskIdSet.has(job.source_generation_task_id)) {
      setCacheOnce(cacheByTaskId, job.source_generation_task_id, job.id);
      continue;
    }

    if (job.source_provider_task_id && job.source_provider_audio_id) {
      setCacheOnce(
        cacheByTaskId,
        taskIdByProviderAudio.get(`${job.source_provider_task_id}::${job.source_provider_audio_id}`),
        job.id,
      );
      continue;
    }

    if (job.source_provider_task_id) {
      setCacheOnce(cacheByTaskId, uniqueTaskIdByProviderTask.get(job.source_provider_task_id), job.id);
    }
  }
}

export async function loadStemCacheByTaskId(
  supabase: SupabaseClient<Database>,
  userId: string,
  tasks: StemCacheTask[],
) {
  const taskIds = tasks.map((task) => task.id).filter(Boolean);
  const taskIdSet = new Set(taskIds);
  const providerTaskIds = Array.from(new Set(tasks.map(getProviderTaskId).filter(Boolean) as string[]));
  const taskIdByProviderAudio = new Map<string, string>();
  const providerTaskCounts = new Map<string, number>();
  const uniqueTaskIdByProviderTask = new Map<string, string>();

  for (const task of tasks) {
    const providerTaskId = getProviderTaskId(task);
    if (!providerTaskId) continue;

    providerTaskCounts.set(providerTaskId, (providerTaskCounts.get(providerTaskId) ?? 0) + 1);
    uniqueTaskIdByProviderTask.set(providerTaskId, task.id);

    if (task.provider_audio_id) {
      taskIdByProviderAudio.set(`${providerTaskId}::${task.provider_audio_id}`, task.id);
    }
  }

  for (const [providerTaskId, count] of providerTaskCounts) {
    if (count !== 1) uniqueTaskIdByProviderTask.delete(providerTaskId);
  }

  const cacheByTaskId = new Map<string, StemCacheSummary>();

  if (taskIds.length > 0) {
    const { data: exactJobs, error } = await supabase
      .from('audio_stem_jobs')
      .select('id,source_generation_task_id,source_provider_task_id,source_provider_audio_id')
      .eq('user_id', userId)
      .in('source_generation_task_id', taskIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('stem cache exact query error:', error);
    } else {
      applyStemJobMatches(
        cacheByTaskId,
        taskIdSet,
        taskIdByProviderAudio,
        uniqueTaskIdByProviderTask,
        (exactJobs ?? []) as StemJobRow[],
      );
    }
  }

  if (providerTaskIds.length > 0) {
    const { data: providerJobs, error } = await supabase
      .from('audio_stem_jobs')
      .select('id,source_generation_task_id,source_provider_task_id,source_provider_audio_id')
      .eq('user_id', userId)
      .in('source_provider_task_id', providerTaskIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('stem cache provider query error:', error);
    } else {
      applyStemJobMatches(
        cacheByTaskId,
        taskIdSet,
        taskIdByProviderAudio,
        uniqueTaskIdByProviderTask,
        (providerJobs ?? []) as StemJobRow[],
      );
    }
  }

  return cacheByTaskId;
}
