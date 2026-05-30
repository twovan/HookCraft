import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeStemMasterState } from '@/lib/stems/stemMixState';

export const dynamic = 'force-dynamic';

interface TrackStatePayload {
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number | null;
  fadeIn: number;
  fadeOut: number;
}

function normalizeTrackState(value: unknown): TrackStatePayload | null {
  const state = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  if (!state) return null;

  const volume = typeof state.volume === 'number' && Number.isFinite(state.volume)
    ? Math.max(0, Math.min(1, state.volume))
    : 1;
  const pan = typeof state.pan === 'number' && Number.isFinite(state.pan)
    ? Math.max(-1, Math.min(1, state.pan))
    : 0;
  const trimStart = typeof state.trimStart === 'number' && Number.isFinite(state.trimStart)
    ? Math.max(0, state.trimStart)
    : 0;
  const trimEnd = typeof state.trimEnd === 'number' && Number.isFinite(state.trimEnd)
    ? Math.max(0, state.trimEnd)
    : null;
  const fadeIn = typeof state.fadeIn === 'number' && Number.isFinite(state.fadeIn)
    ? Math.max(0, state.fadeIn)
    : 0;
  const fadeOut = typeof state.fadeOut === 'number' && Number.isFinite(state.fadeOut)
    ? Math.max(0, state.fadeOut)
    : 0;

  return {
    volume,
    pan,
    muted: state.muted === true,
    solo: state.solo === true,
    trimStart,
    trimEnd,
    fadeIn,
    fadeOut,
  };
}

function normalizeTrackLabels(value: unknown) {
  const labels = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  if (!labels) return {};

  return Object.fromEntries(
    Object.entries(labels)
      .map(([type, label]) => [
        type.trim().slice(0, 80),
        String(label || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      ])
      .filter(([type, label]) => type.length > 0 && label.length > 0),
  );
}

function normalizeTrackOrder(value: unknown, knownTrackTypes: string[]) {
  if (!Array.isArray(value)) return [];
  const knownTrackTypeSet = new Set(knownTrackTypes);

  return value
    .map((type) => String(type || '').trim().slice(0, 80))
    .filter((type, index, types) => type.length > 0 && knownTrackTypeSet.has(type) && types.indexOf(type) === index)
    .slice(0, 64);
}

function normalizeEditState(value: unknown) {
  const editState = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  const tracks = editState?.tracks && typeof editState.tracks === 'object'
    ? editState.tracks as Record<string, unknown>
    : null;
  if (!tracks) return null;

  const normalizedTracks = Object.fromEntries(
    Object.entries(tracks)
      .filter(([type]) => type.length > 0 && type.length <= 80)
      .map(([type, state]) => [type, normalizeTrackState(state)])
      .filter((entry): entry is [string, TrackStatePayload] => Boolean(entry[1])),
  );

  if (Object.keys(normalizedTracks).length === 0 || Object.keys(normalizedTracks).length > 64) {
    return null;
  }

  const trackLabels = normalizeTrackLabels(editState?.trackLabels);
  const trackOrder = normalizeTrackOrder(editState?.trackOrder, Object.keys(normalizedTracks));

  return {
    tracks: normalizedTracks,
    master: normalizeStemMasterState(editState?.master as any),
    ...(Object.keys(trackLabels).length > 0 ? { trackLabels } : {}),
    ...(trackOrder.length > 0 ? { trackOrder } : {}),
    savedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
    const editState = normalizeEditState(body?.editState);

    if (!jobId || !editState) {
      return NextResponse.json({ error: 'Invalid edit state payload' }, { status: 400 });
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

    const { error: updateError } = await supabaseAdmin
      .from('audio_stem_jobs')
      .update({
        result_payload: {
          ...currentPayload,
          editState,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, editState });
  } catch (error: any) {
    console.error('[stems/edit-state] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save edit state' },
      { status: 500 },
    );
  }
}
