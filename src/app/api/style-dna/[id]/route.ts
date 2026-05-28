import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const bundle = await repo.getJobBundle(params.id, user.id);
  return NextResponse.json(bundle);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const body = await req.json();
  const { error } = await (supabaseAdmin as any)
    .from('style_dnas')
    .update({
      genre: body.genre,
      tempo_range: body.tempoRange,
      key_mood: body.keyMood,
      primary_instruments: body.primaryInstruments,
      secondary_instruments: body.secondaryInstruments,
      drum_pattern: body.drumPattern,
      bass_pattern: body.bassPattern,
      harmony_language: body.harmonyLanguage,
      arrangement_formula: body.arrangementFormula,
      production_texture: body.productionTexture,
      avoid_tags: body.avoidTags,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('job_id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
