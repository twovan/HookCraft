import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import { CreditService } from '@/lib/credits/CreditService';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';
import type { CreditOperationType } from '@/types/credits';
import type { SunoProviderPayload } from '@/types/style-dna';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const bundle = await repo.getJobBundle(params.id, user.id);
  const latestPackage = bundle.promptPackages[0];
  const firstTrack = bundle.tracks[0];
  if (!latestPackage) return NextResponse.json({ error: 'Prompt package not found' }, { status: 404 });
  if (!firstTrack?.public_url) return NextResponse.json({ error: 'Reference audio not found' }, { status: 404 });

  const providerPayload = latestPackage.provider_payload as unknown as SunoProviderPayload;
  const creditService = new CreditService(supabaseAdmin);
  const creditOperations: CreditOperationType[] = ['cover_generation'];
  if (!(await creditService.hasEnoughCredits(user.id, creditOperations))) {
    return NextResponse.json({ error: 'Credits balance is not enough' }, { status: 402 });
  }

  const provider = new KieSunoProvider();
  const batchId = createId('style-kie-batch');
  const localTaskId = createId('style-kie-task');
  const promptSummary = [
    `Title: ${providerPayload.title || latestPackage.title}`,
    `Style: ${providerPayload.style || latestPackage.style_prompt}`,
    providerPayload.prompt,
  ].filter(Boolean).join('\n\n');

  const { error: batchError } = await supabaseAdmin.from('generation_batches').insert({
    id: batchId,
    user_id: user.id,
    template_id: null,
    prompt: promptSummary,
    title: providerPayload.title || latestPackage.title,
    generation_type: 'full_demo',
    use_premium_singer: false,
    version_count: 1,
    status: 'generating',
  } as any);
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 });

  const { error: taskError } = await supabaseAdmin.from('generation_tasks').insert({
    id: localTaskId,
    user_id: user.id,
    generation_type: 'full_demo',
    status: 'generating',
    prompt: promptSummary,
    title: providerPayload.title || latestPackage.title,
    template_id: null,
    model_id: 'kie-suno-v5_5',
    audio_path: null,
    raw_audio_path: firstTrack.public_url,
    lyrics: providerPayload.instrumental ? null : providerPayload.prompt,
    song_structure: latestPackage.structure_prompt || null,
    credits_consumed: 0,
    batch_id: batchId,
    version_number: 1,
    duration_seconds: null,
  } as any);
  if (taskError) {
    await supabaseAdmin.from('generation_batches').delete().eq('id', batchId).eq('user_id', user.id);
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  try {
    const callBackUrl = `${req.nextUrl.origin}/api/kie/upload-cover/callback?localTaskId=${encodeURIComponent(localTaskId)}`;
    const result = await provider.uploadAndCover({
      uploadUrl: firstTrack.public_url,
      prompt: providerPayload.prompt,
      style: providerPayload.style,
      title: providerPayload.title,
      negativeTags: providerPayload.negativeTags,
      customMode: true,
      instrumental: providerPayload.instrumental,
      model: providerPayload.model || 'V5_5',
      callBackUrl,
    });

    const consumeResult = await creditService.consumeCredits(user.id, creditOperations);
    if (!consumeResult.success) {
      throw new Error(consumeResult.error || 'Credits deduction failed');
    }

    await supabaseAdmin.from('generation_tasks').update({
      raw_audio_path: `kie:${result.taskId}`,
      credits_consumed: consumeResult.consumed,
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);

    await repo.updateJobStatus(params.id, user.id, 'generating');

    return NextResponse.json({
      ...result,
      localTaskId,
      batchId,
      statusUrl: `/api/kie/upload-cover/status?taskId=${encodeURIComponent(result.taskId)}&localTaskId=${encodeURIComponent(localTaskId)}`,
      creationUrl: `/account/creations?expand=${encodeURIComponent(batchId)}`,
    });
  } catch (error: any) {
    await supabaseAdmin.from('generation_tasks').update({
      status: 'failed',
      error_code: 'STYLE_DNA_KIE_FAILED',
      error_message: error?.message || 'Style DNA generation failed',
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);
    await supabaseAdmin.from('generation_batches').update({ status: 'failed', updated_at: new Date().toISOString() } as any)
      .eq('id', batchId)
      .eq('user_id', user.id);
    return NextResponse.json({ error: error?.message || 'Style DNA generation failed' }, { status: 500 });
  }
}
