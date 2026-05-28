import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { refinePromptPackage } from '@/lib/style-dna/PromptRefiner';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';
import type { GenerationFeedback, StyleDNA, SunoPromptPackage } from '@/types/style-dna';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapDna(row: any): StyleDNA {
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

function mapPackage(row: any): SunoPromptPackage {
  return {
    id: row.id,
    styleDnaId: row.style_dna_id,
    title: row.title,
    stylePromptShort: row.style_prompt_short,
    stylePromptMedium: row.style_prompt_medium,
    stylePromptLong: row.style_prompt_long,
    stylePrompt: row.style_prompt,
    lyricPrompt: row.lyric_prompt,
    instrumentalPrompt: row.instrumental_prompt,
    structurePrompt: row.structure_prompt,
    negativePrompt: row.negative_prompt,
    customMode: row.custom_mode,
    instrumental: row.instrumental,
    providerPayload: row.provider_payload,
    promptVersion: row.prompt_version,
    changeSummary: row.change_summary || undefined,
    createdAt: row.created_at,
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const body = await req.json();
  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const bundle = await repo.getJobBundle(params.id, user.id);
  const latestDna = bundle.styleDnas[0];
  const latestPackage = bundle.promptPackages[0];
  if (!latestDna || !latestPackage) return NextResponse.json({ error: 'Prompt package not found' }, { status: 404 });

  const now = new Date().toISOString();
  const feedback: GenerationFeedback = {
    id: createId('feedback'),
    generationId: body.generationId || null,
    promptPackageId: latestPackage.id,
    styleDnaId: latestDna.id,
    rating: body.rating ?? null,
    feedbackText: body.feedbackText || null,
    tooElectronic: Boolean(body.tooElectronic),
    tooRock: Boolean(body.tooRock),
    tooGeneric: Boolean(body.tooGeneric),
    drumsTooHeavy: Boolean(body.drumsTooHeavy),
    chorusNotBigEnough: Boolean(body.chorusNotBigEnough),
    vocalNotForward: Boolean(body.vocalNotForward),
    notMandarinPopEnough: Boolean(body.notMandarinPopEnough),
    harmonyTooSimple: Boolean(body.harmonyTooSimple),
    arrangementTooFlat: Boolean(body.arrangementTooFlat),
    emotionNotProgressive: Boolean(body.emotionNotProgressive),
    melodyMismatch: Boolean(body.melodyMismatch),
    arrangementMismatch: Boolean(body.arrangementMismatch),
    vocalMismatch: Boolean(body.vocalMismatch),
    structureMismatch: Boolean(body.structureMismatch),
    suggestedChanges: body.suggestedChanges || null,
    createdAt: now,
  };

  await repo.createFeedback({
    id: feedback.id,
    generation_id: feedback.generationId,
    prompt_package_id: feedback.promptPackageId,
    style_dna_id: feedback.styleDnaId,
    user_id: user.id,
    rating: feedback.rating,
    feedback_text: feedback.feedbackText,
    too_electronic: feedback.tooElectronic,
    too_rock: feedback.tooRock,
    too_generic: feedback.tooGeneric,
    drums_too_heavy: feedback.drumsTooHeavy,
    chorus_not_big_enough: feedback.chorusNotBigEnough,
    vocal_not_forward: feedback.vocalNotForward,
    not_mandarin_pop_enough: feedback.notMandarinPopEnough,
    harmony_too_simple: feedback.harmonyTooSimple,
    arrangement_too_flat: feedback.arrangementTooFlat,
    emotion_not_progressive: feedback.emotionNotProgressive,
    melody_mismatch: feedback.melodyMismatch,
    arrangement_mismatch: feedback.arrangementMismatch,
    vocal_mismatch: feedback.vocalMismatch,
    structure_mismatch: feedback.structureMismatch,
    suggested_changes: feedback.suggestedChanges,
    created_at: now,
  });

  const refined = refinePromptPackage(mapDna(latestDna), mapPackage(latestPackage), feedback, {
    id: createId('suno-pkg'),
    createdAt: now,
  });

  await repo.createPromptPackage({
    id: refined.id,
    style_dna_id: refined.styleDnaId,
    job_id: params.id,
    user_id: user.id,
    title: refined.title,
    style_prompt_short: refined.stylePromptShort,
    style_prompt_medium: refined.stylePromptMedium,
    style_prompt_long: refined.stylePromptLong,
    style_prompt: refined.stylePrompt,
    lyric_prompt: refined.lyricPrompt,
    instrumental_prompt: refined.instrumentalPrompt,
    structure_prompt: refined.structurePrompt,
    negative_prompt: refined.negativePrompt,
    custom_mode: refined.customMode,
    instrumental: refined.instrumental,
    provider_payload: refined.providerPayload,
    prompt_version: refined.promptVersion,
    change_summary: refined.changeSummary || null,
    created_at: refined.createdAt,
  });

  return NextResponse.json({ feedback, promptPackage: refined });
}

