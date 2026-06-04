import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeEditState } from '@/lib/stems/stemEditStatePayload';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录后再保存编辑状态。' }, { status: 401 });
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
