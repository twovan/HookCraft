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
  request_payload?: unknown;
  result_payload?: unknown;
}

export type StemCacheMode = 'basic' | 'pro';

export interface StemCacheSummary {
  jobId: string;
  hasStemCache: boolean;
  stemCacheModes: StemCacheMode[];
  basicJobId?: string | null;
  proJobId?: string | null;
  editSavedAt?: string | null;
}

function readStemEditSavedAt(resultPayload: unknown) {
  const payload = resultPayload && typeof resultPayload === 'object'
    ? resultPayload as Record<string, unknown>
    : null;
  const editState = payload?.editState && typeof payload.editState === 'object'
    ? payload.editState as Record<string, unknown>
    : null;
  const savedAt = typeof editState?.savedAt === 'string' ? editState.savedAt : null;
  return savedAt && !Number.isNaN(Date.parse(savedAt)) ? savedAt : null;
}

function parseKieTaskId(rawAudioPath?: string | null) {
  return rawAudioPath?.startsWith('kie:')
    ? rawAudioPath.slice('kie:'.length)
    : null;
}

function getProviderTaskId(task: StemCacheTask) {
  return task.provider_task_id || parseKieTaskId(task.raw_audio_path);
}

function readStemCacheMode(requestPayload: unknown): StemCacheMode {
  const payload = requestPayload && typeof requestPayload === 'object'
    ? requestPayload as Record<string, unknown>
    : {};
  return payload.type === 'separate_vocal' ? 'basic' : 'pro';
}

function latestEditSavedAt(current: string | null | undefined, next: string | null) {
  if (!current) return next;
  if (!next) return current;
  return Date.parse(next) > Date.parse(current) ? next : current;
}

export function mergeStemCacheSummary(
  current: StemCacheSummary | undefined,
  jobId: string,
  mode: StemCacheMode,
  editSavedAt: string | null,
): StemCacheSummary {
  const stemCacheModes = current?.stemCacheModes.includes(mode)
    ? current.stemCacheModes
    : [...(current?.stemCacheModes ?? []), mode];

  return {
    jobId: current?.jobId ?? jobId,
    hasStemCache: true,
    stemCacheModes,
    basicJobId: current?.basicJobId ?? (mode === 'basic' ? jobId : null),
    proJobId: current?.proJobId ?? (mode === 'pro' ? jobId : null),
    editSavedAt: latestEditSavedAt(current?.editSavedAt, editSavedAt),
  };
}

function setCache(
  cacheByTaskId: Map<string, StemCacheSummary>,
  taskId: string | undefined,
  jobId: string,
  mode: StemCacheMode,
  editSavedAt: string | null,
) {
  if (!taskId) return;
  cacheByTaskId.set(
    taskId,
    mergeStemCacheSummary(cacheByTaskId.get(taskId), jobId, mode, editSavedAt),
  );
}

function applyStemJobMatches(
  cacheByTaskId: Map<string, StemCacheSummary>,
  taskIdSet: Set<string>,
  taskIdByProviderAudio: Map<string, string>,
  uniqueTaskIdByProviderTask: Map<string, string>,
  jobs: StemJobRow[],
) {
  for (const job of jobs) {
    const mode = readStemCacheMode(job.request_payload);
    const editSavedAt = readStemEditSavedAt(job.result_payload);

    if (taskIdSet.has(job.source_generation_task_id)) {
      setCache(cacheByTaskId, job.source_generation_task_id, job.id, mode, editSavedAt);
      continue;
    }

    if (job.source_provider_task_id && job.source_provider_audio_id) {
      const taskId = taskIdByProviderAudio.get(`${job.source_provider_task_id}::${job.source_provider_audio_id}`);
      setCache(
        cacheByTaskId,
        taskId,
        job.id,
        mode,
        editSavedAt,
      );
      continue;
    }

    if (job.source_provider_task_id) {
      const taskId = uniqueTaskIdByProviderTask.get(job.source_provider_task_id);
      setCache(cacheByTaskId, taskId, job.id, mode, editSavedAt);
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
      .select('id,source_generation_task_id,source_provider_task_id,source_provider_audio_id,request_payload,result_payload')
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
      .select('id,source_generation_task_id,source_provider_task_id,source_provider_audio_id,request_payload,result_payload')
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
