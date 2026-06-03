import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import { supabaseAdmin } from '@/lib/supabase/server';
import { readNormalizedStems } from '@/lib/stems/kieStemResult';
import { resolveKieStemSource } from '@/lib/stems/kieStemSource';
import { CreditService } from '@/lib/credits/CreditService';
import type { CreditOperationType } from '@/types/credits';
import type { MembershipTier } from '@/types/membership';
import {
  editorPanelForSeparationMode,
  normalizeStemEditorFeatureSettings,
  resolveEditorPanelAccess,
  resolveStemSeparationMode,
  type StemSeparationMode,
} from '@/config/stemEditorFeatures';
import { readStemEditorFeatureSettings } from '@/lib/studio/StemEditorFeatureSettingsStore';

export const dynamic = 'force-dynamic';

function createId() {
  return `stem-job-${Date.now()}-${crypto.randomUUID()}`;
}

function createStatelessKieJobId(providerTaskId: string) {
  return `kie:${providerTaskId}`;
}

function isMissingStemJobsTableError(error: unknown) {
  const value = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  const code = typeof value.code === 'string' ? value.code : '';

  return code === 'PGRST205' || message.includes('audio_stem_jobs');
}

function readSeparationMode(payload: unknown): StemSeparationMode {
  const value = payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};
  return value.type === 'separate_vocal' ? 'separate_vocal' : 'split_stem';
}

function creditOperationsForMode(mode: StemSeparationMode): CreditOperationType[] {
  return mode === 'separate_vocal'
    ? ['stem_split']
    : ['stem_split_advanced'];
}

async function readUserMembershipTier(userId: string): Promise<MembershipTier> {
  const { data, error } = await supabaseAdmin
    .from('memberships')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.tier || 'free') as MembershipTier;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再创建分轨任务。' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const generationTaskId = typeof body?.generationTaskId === 'string'
      ? body.generationTaskId.trim()
      : '';
    const force = body?.force === true;
    const requestedSeparationMode = body?.separationMode;

    if (!generationTaskId) {
      return NextResponse.json({ error: 'Missing generationTaskId' }, { status: 400 });
    }

    const [membershipTier, featureSettings] = await Promise.all([
      readUserMembershipTier(user.id),
      readStemEditorFeatureSettings(supabaseAdmin).catch(() => normalizeStemEditorFeatureSettings(null)),
    ]);
    const membershipEditorPanel = resolveEditorPanelAccess(membershipTier);
    const separationMode = resolveStemSeparationMode(featureSettings, membershipEditorPanel, requestedSeparationMode);
    if (!separationMode) {
      return NextResponse.json({ error: 'Stem editor is not available for this membership tier' }, { status: 403 });
    }
    const editorPanel = editorPanelForSeparationMode(separationMode);

    const { data: existingJobs, error: existingError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id,status,provider_task_id,request_payload,result_payload,error_message')
      .eq('source_generation_task_id', generationTaskId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const canPersistStemJobs = !isMissingStemJobsTableError(existingError);
    if (existingError && canPersistStemJobs) throw existingError;
    const modeJobs = Array.isArray(existingJobs)
      ? existingJobs.filter((job) => readSeparationMode((job as any).request_payload) === separationMode)
      : [];
    const existing = modeJobs.length > 0
      ? modeJobs.find((job) => job.status === 'completed' && readNormalizedStems(job.result_payload).length > 0)
        || modeJobs.find((job) => job.status === 'queued' || job.status === 'processing')
        || modeJobs.find((job) => job.status === 'completed')
        || modeJobs[0]
      : null;

    if (existing && !force) {
      const recoveredStems = readNormalizedStems(existing.result_payload);
      const isCachedCompleted = existing.status === 'completed' && recoveredStems.length > 0;
      if (existing.status === 'failed' && recoveredStems.length > 0) {
        await supabaseAdmin
          .from('audio_stem_jobs')
          .update({
            status: 'completed',
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('user_id', user.id);
      }

      return NextResponse.json({
        jobId: existing.id,
        status: existing.status === 'failed' && recoveredStems.length > 0
          ? 'completed'
          : existing.status,
        providerTaskId: existing.provider_task_id,
        errorMessage: existing.error_message,
        reused: true,
        analysisSource: isCachedCompleted ? 'cache' : 'existing-job',
        cachedStemCount: recoveredStems.length,
        separationMode,
        editorPanel,
      });
    }

    const provider = new KieSunoProvider();
    const source = await resolveKieStemSource(
      supabaseAdmin,
      generationTaskId,
      user.id,
      provider,
    );

    if (!canPersistStemJobs) {
      return NextResponse.json({
        error: 'Stem cache table is not initialized. Please run supabase/migrations/012_audio_stem_jobs.sql before requesting stem analysis.',
        status: 'failed',
        persisted: false,
        reused: false,
        setupRequired: true,
        analysisSource: 'storage-missing',
        separationMode,
        editorPanel,
      }, { status: 503 });
    }

    const creditService = new CreditService(supabaseAdmin);
    const creditOperations = creditOperationsForMode(separationMode);
    if (!(await creditService.hasEnoughCredits(user.id, creditOperations))) {
      return NextResponse.json({ error: 'Credits balance is not enough' }, { status: 402 });
    }

    const stemJobId = createId();
    const callBackUrl = `${req.nextUrl.origin}/api/kie/stems/callback?stemJobId=${encodeURIComponent(stemJobId)}`;
    const requestPayload = {
      sourceGenerationTaskId: source.generationTaskId,
      sourceTaskId: source.sourceTaskId,
      sourceAudioId: source.sourceAudioId,
      callBackUrl,
      type: separationMode,
      editorPanel,
      membershipTier,
    };

    const { error: insertError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .insert({
        id: stemJobId,
        user_id: user.id,
        source_generation_task_id: source.generationTaskId,
        provider: 'kie',
        source_provider_task_id: source.sourceTaskId,
        source_provider_audio_id: source.sourceAudioId,
        status: 'queued',
        request_payload: requestPayload,
      });

    if (insertError) throw insertError;

    try {
      const created = await provider.splitStems({
        sourceTaskId: source.sourceTaskId,
        sourceAudioId: source.sourceAudioId,
        type: separationMode,
        callBackUrl,
      });

      const { error: updateError } = await supabaseAdmin
        .from('audio_stem_jobs')
        .update({
          provider_task_id: created.taskId,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', stemJobId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      const consumeResult = await creditService.consumeCredits(user.id, creditOperations);
      if (!consumeResult.success) {
        await supabaseAdmin
          .from('audio_stem_jobs')
          .update({
            status: 'failed',
            error_message: 'Credits deduction failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', stemJobId)
          .eq('user_id', user.id);

        return NextResponse.json({
          jobId: stemJobId,
          status: 'failed',
          error: 'Credits deduction failed',
          reused: false,
          analysisSource: 'billing-failed',
          separationMode,
          editorPanel,
        }, { status: 402 });
      }

      return NextResponse.json({
        jobId: stemJobId,
        providerTaskId: created.taskId,
        status: 'processing',
        reused: false,
        analysisSource: 'api-created',
        separationMode,
        editorPanel,
      }, { status: 202 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'KIE stem split request failed';

      await supabaseAdmin
        .from('audio_stem_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stemJobId)
        .eq('user_id', user.id);

      return NextResponse.json({
        jobId: stemJobId,
        status: 'failed',
        error: errorMessage,
        errorMessage,
        reused: false,
        analysisSource: 'api-failed',
        separationMode,
        editorPanel,
      }, { status: errorMessage.toLowerCase().includes('credit') ? 402 : 502 });
    }
  } catch (error: any) {
    console.error('[stems/create] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create stem split job' },
      { status: 500 },
    );
  }
}
