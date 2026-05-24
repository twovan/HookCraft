import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function isValidWaveform(value: unknown) {
  const waveform = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  if (!waveform) return false;
  if (typeof waveform.duration !== 'number' || !Number.isFinite(waveform.duration)) return false;
  if (!Array.isArray(waveform.peaks) || waveform.peaks.length === 0 || waveform.peaks.length > 2000) return false;
  return waveform.peaks.every((peak) => (
    typeof peak === 'number' &&
    Number.isFinite(peak) &&
    peak >= 0 &&
    peak <= 1
  ));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
    const stemType = typeof body?.stemType === 'string' ? body.stemType.trim() : '';
    const waveform = body?.waveform;

    if (!jobId || !stemType || !isValidWaveform(waveform)) {
      return NextResponse.json({ error: 'Invalid waveform payload' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id,result_payload')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json({ error: 'Stem job not found' }, { status: 404 });
    }

    const currentPayload = job.result_payload && typeof job.result_payload === 'object'
      ? job.result_payload as Record<string, unknown>
      : {};
    const currentWaveforms = currentPayload.waveformPeaks && typeof currentPayload.waveformPeaks === 'object'
      ? currentPayload.waveformPeaks as Record<string, unknown>
      : {};

    const nextPayload = {
      ...currentPayload,
      waveformPeaks: {
        ...currentWaveforms,
        [stemType]: waveform,
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .update({
        result_payload: nextPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[stems/waveforms] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save waveform' },
      { status: 500 },
    );
  }
}
