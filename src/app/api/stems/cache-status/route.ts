import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { readNormalizedStems } from '@/lib/stems/kieStemResult';

export const dynamic = 'force-dynamic';

type CacheMode = 'basic' | 'pro';

function readCacheMode(requestPayload: unknown): CacheMode {
  const payload = requestPayload && typeof requestPayload === 'object'
    ? requestPayload as Record<string, unknown>
    : {};
  return payload.type === 'separate_vocal' ? 'basic' : 'pro';
}

function readEditSavedAt(resultPayload: unknown) {
  const payload = resultPayload && typeof resultPayload === 'object'
    ? resultPayload as Record<string, unknown>
    : {};
  const editState = payload.editState && typeof payload.editState === 'object'
    ? payload.editState as Record<string, unknown>
    : {};
  const savedAt = typeof editState.savedAt === 'string' ? editState.savedAt : null;
  return savedAt && !Number.isNaN(Date.parse(savedAt)) ? savedAt : null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再读取分轨缓存状态。' }, { status: 401 });
    }

    const generationTaskId = req.nextUrl.searchParams.get('generationTaskId')?.trim() || '';
    if (!generationTaskId) {
      return NextResponse.json({ error: 'Missing generationTaskId' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('audio_stem_jobs')
      .select('id,request_payload,result_payload,updated_at')
      .eq('source_generation_task_id', generationTaskId)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const modes: Partial<Record<CacheMode, {
      jobId: string;
      cachedStemCount: number;
      editSavedAt: string | null;
      updatedAt: string | null;
    }>> = {};

    for (const job of data ?? []) {
      const mode = readCacheMode((job as any).request_payload);
      if (modes[mode]) continue;

      const cachedStemCount = readNormalizedStems((job as any).result_payload).length;
      if (cachedStemCount <= 0) continue;

      modes[mode] = {
        jobId: job.id,
        cachedStemCount,
        editSavedAt: readEditSavedAt((job as any).result_payload),
        updatedAt: job.updated_at ?? null,
      };
    }

    return NextResponse.json({ generationTaskId, modes });
  } catch (error: any) {
    console.error('[stems/cache-status] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load stem cache status' },
      { status: 500 },
    );
  }
}
