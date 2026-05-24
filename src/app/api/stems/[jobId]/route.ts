import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import { supabaseAdmin } from '@/lib/supabase/server';
import { readNormalizedStems } from '@/lib/stems/kieStemResult';

export const dynamic = 'force-dynamic';

const STATELESS_KIE_PREFIX = 'kie:';

function getStatelessKieProviderTaskId(jobId: string) {
  return jobId.startsWith(STATELESS_KIE_PREFIX)
    ? jobId.slice(STATELESS_KIE_PREFIX.length)
    : null;
}

function mapKieStemStatus(status: string) {
  if (status === 'SUCCESS') return 'completed';
  if (
    status === 'CREATE_TASK_FAILED' ||
    status === 'GENERATE_AUDIO_FAILED' ||
    status === 'CALLBACK_EXCEPTION'
  ) {
    return 'failed';
  }
  return 'processing';
}

function readWaveformPeaks(resultPayload: unknown) {
  const value = resultPayload && typeof resultPayload === 'object'
    ? resultPayload as Record<string, any>
    : {};
  return value.waveformPeaks && typeof value.waveformPeaks === 'object'
    ? value.waveformPeaks as Record<string, unknown>
    : {};
}

function readEditState(resultPayload: unknown) {
  const value = resultPayload && typeof resultPayload === 'object'
    ? resultPayload as Record<string, unknown>
    : {};
  return value.editState && typeof value.editState === 'object'
    ? value.editState
    : null;
}

function proxiedStems(req: NextRequest, resultPayload: unknown) {
  const waveformPeaks = readWaveformPeaks(resultPayload);
  return readNormalizedStems(resultPayload).map((stem) => ({
    ...stem,
    sourceUrl: stem.url,
    url: `${req.nextUrl.origin}/api/stems/audio?url=${encodeURIComponent(stem.url)}`,
    waveform: waveformPeaks[stem.type] || null,
  }));
}

async function refreshPersistedKieJob(job: {
  id: string;
  status: string;
  provider_task_id: string | null;
  result_payload: unknown;
  error_message: string | null;
  user_id?: string;
}) {
  const cachedStems = readNormalizedStems(job.result_payload);
  const needsResultHydration = job.status === 'completed' && cachedStems.length === 0;

  if (
    !needsResultHydration &&
    job.status !== 'queued' &&
    job.status !== 'processing'
  ) {
    return { job, analysisSource: cachedStems.length > 0 ? 'cache' : 'empty-cache' };
  }

  if (!job.provider_task_id) {
    return { job, analysisSource: cachedStems.length > 0 ? 'cache' : 'waiting-provider-task' };
  }

  const details = await new KieSunoProvider().getStemSplitDetails(job.provider_task_id);
  const nextStatus = mapKieStemStatus(details.status);
  const normalizedStems = readNormalizedStems({ response: details.response });
  const existingPayload = job.result_payload && typeof job.result_payload === 'object'
    ? job.result_payload as Record<string, unknown>
    : {};
  const nextPayload = {
    ...existingPayload,
    response: details.response,
    normalizedStems,
  };

  if (nextStatus === 'completed' || nextStatus === 'failed' || needsResultHydration) {
    const hydratedStatus = normalizedStems.length > 0 ? 'completed' : nextStatus;
    const { error } = await supabaseAdmin
      .from('audio_stem_jobs')
      .update({
        status: hydratedStatus,
        result_payload: nextPayload,
        error_message: details.errorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) throw error;

    return {
      job: {
        ...job,
        status: hydratedStatus,
        result_payload: nextPayload,
        error_message: details.errorMessage || null,
      },
      analysisSource: needsResultHydration ? 'api-hydrated-cache' : 'api-refreshed',
    };
  }

  return { job, analysisSource: 'api-processing' };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const statelessProviderTaskId = getStatelessKieProviderTaskId(params.jobId);
    if (statelessProviderTaskId) {
      const details = await new KieSunoProvider().getStemSplitDetails(statelessProviderTaskId);

      return NextResponse.json({
        jobId: params.jobId,
        status: mapKieStemStatus(details.status),
        provider: 'kie',
        providerTaskId: details.taskId,
        sourceGenerationTaskId: null,
        stems: proxiedStems(req, { response: details.response }),
        editState: null,
        errorMessage: details.errorMessage || null,
        createdAt: null,
        updatedAt: null,
        persisted: false,
        analysisSource: 'api-stateless',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id,status,provider,provider_task_id,source_generation_task_id,result_payload,error_message,created_at,updated_at')
      .eq('id', params.jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Stem job not found' }, { status: 404 });
    }

    const refreshed = await refreshPersistedKieJob(data);
    const refreshedData = refreshed.job;
    const stems = proxiedStems(req, refreshedData.result_payload);
    const editState = readEditState(refreshedData.result_payload);

    return NextResponse.json({
      jobId: refreshedData.id,
      status: refreshedData.status,
      provider: data.provider,
      providerTaskId: refreshedData.provider_task_id,
      sourceGenerationTaskId: data.source_generation_task_id,
      stems,
      editState,
      errorMessage: refreshedData.error_message,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      analysisSource: stems.length > 0 && refreshed.analysisSource === 'cache'
        ? 'cache'
        : refreshed.analysisSource,
    });
  } catch (error: any) {
    console.error('[stems/job] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load stem job' },
      { status: 500 },
    );
  }
}
