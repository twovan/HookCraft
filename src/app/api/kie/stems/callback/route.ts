import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeKieStemCallback } from '@/lib/stems/kieStemResult';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const stemJobId = req.nextUrl.searchParams.get('stemJobId');
    const stateless = req.nextUrl.searchParams.get('stateless') === '1';
    const payload = await req.json().catch(() => null);

    if (!payload) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    if (stateless) {
      return NextResponse.json({ success: true });
    }

    if (!stemJobId) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const result = normalizeKieStemCallback(payload);

    const { error } = await supabaseAdmin
      .from('audio_stem_jobs')
      .update({
        provider_task_id: result.providerTaskId,
        status: result.status,
        result_payload: {
          providerPayload: payload as Record<string, unknown>,
          normalizedStems: result.stems,
        },
        error_message: result.errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stemJobId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[kie/stems/callback] Error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true });
}
