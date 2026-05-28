import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { composeSunoPromptPackage } from '@/lib/style-dna/PromptComposer';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';
import type { StyleDNA } from '@/types/style-dna';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapStyleDna(row: any): StyleDNA {
  return {
    id: row.id,
    name: row.name,
    sourceTrackIds: row.source_track_ids || [],
    summary: row.summary || '',
    genre: row.genre || [],
    tempoRange: row.tempo_range || 'unknown',
    keyMood: row.key_mood || 'unknown',
    primaryInstruments: row.primary_instruments || [],
    secondaryInstruments: row.secondary_instruments || [],
    drumPattern: row.drum_pattern || 'unknown',
    bassPattern: row.bass_pattern || 'unknown',
    harmonyLanguage: row.harmony_language || 'unknown',
    arrangementFormula: row.arrangement_formula || {},
    sectionStructure: row.section_structure || {},
    productionTexture: row.production_texture || 'unknown',
    emotionalArc: row.emotional_arc || '',
    chinesePopSpecificTraits: row.chinese_pop_specific_traits || [],
    sunoFriendlyStyleTags: row.suno_friendly_style_tags || [],
    avoidTags: row.avoid_tags || [],
    highFrequencyTraits: row.high_frequency_traits || [],
    lowFrequencyTraits: row.low_frequency_traits || [],
    uncertainTraits: row.uncertain_traits || [],
    confidence: Number(row.confidence || 0),
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const bundle = await repo.getJobBundle(params.id, user.id);
  const latestDna = bundle.styleDnas[0];
  if (!latestDna) return NextResponse.json({ error: 'Style DNA not found' }, { status: 404 });

  const now = new Date().toISOString();
  const latestVersion = Math.max(0, ...bundle.promptPackages.map((item: any) => Number(item.prompt_version || 0)));
  const dna = mapStyleDna(latestDna);
  const pkg = composeSunoPromptPackage(dna, {
    id: createId('suno-pkg'),
    title: String(body.title || latestDna.name || 'Style DNA Demo'),
    instrumental: Boolean(body.instrumental ?? bundle.promptPackages[0]?.instrumental),
    createdAt: now,
    promptVersion: latestVersion + 1,
    changeSummary: 'Recomposed from edited Style DNA',
  });

  await repo.createPromptPackage({
    id: pkg.id,
    style_dna_id: pkg.styleDnaId,
    job_id: params.id,
    user_id: user.id,
    title: pkg.title,
    style_prompt_short: pkg.stylePromptShort,
    style_prompt_medium: pkg.stylePromptMedium,
    style_prompt_long: pkg.stylePromptLong,
    style_prompt: pkg.stylePrompt,
    lyric_prompt: pkg.lyricPrompt,
    instrumental_prompt: pkg.instrumentalPrompt,
    structure_prompt: pkg.structurePrompt,
    negative_prompt: pkg.negativePrompt,
    custom_mode: pkg.customMode,
    instrumental: pkg.instrumental,
    provider_payload: pkg.providerPayload,
    prompt_version: pkg.promptVersion,
    change_summary: pkg.changeSummary || null,
    created_at: pkg.createdAt,
  });

  return NextResponse.json({ promptPackage: pkg });
}

