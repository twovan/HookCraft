import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleAudioAnalysisProvider } from '@/lib/style-dna/GoogleAudioAnalysisProvider';
import { composeSunoPromptPackage } from '@/lib/style-dna/PromptComposer';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';
import { aggregateStyleDnaLocally } from '@/lib/style-dna/StyleDnaAggregator';
import type { Mode, TrackAnalysis } from '@/types/style-dna';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_TRACKS = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave']);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function safeMode(value: unknown): Mode {
  return value === 'major' || value === 'minor' || value === 'modal' ? value : 'unknown';
}

function toTrackAnalysis(raw: Record<string, unknown>, sourceTrackId: string, fileName: string, now: string): TrackAnalysis {
  const productionTexture = typeof raw.production_texture === 'object' && raw.production_texture
    ? raw.production_texture as Record<string, string>
    : {};

  return {
    id: createId('track-analysis'),
    sourceTrackId,
    title: fileName,
    duration: null,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence || 0))),
    bpmEstimate: Number(raw.estimated_bpm || 0) || null,
    bpmRange: String(raw.bpm_range || 'unknown'),
    keyEstimate: String(raw.estimated_key || 'unknown'),
    mode: safeMode(raw.mode),
    genreCandidates: stringArray(raw.genre_candidates),
    moodTags: stringArray(raw.mood_tags),
    energyCurve: typeof raw.energy_curve === 'object' && raw.energy_curve ? raw.energy_curve as TrackAnalysis['energyCurve'] : {},
    sectionMap: Array.isArray(raw.section_map)
      ? raw.section_map.map((section: any) => ({
          section: String(section.section || 'Unknown'),
          startTime: String(section.start_time || 'unknown'),
          endTime: String(section.end_time || 'unknown'),
          arrangementNotes: String(section.arrangement_notes || ''),
        }))
      : [],
    instrumentation: raw.instrumentation as TrackAnalysis['instrumentation'] || {
      primary: [],
      secondary: [],
      notableAbsentElements: [],
    },
    drumStyle: raw.drum_style as TrackAnalysis['drumStyle'] || { type: 'unknown', density: 'unknown', description: '' },
    bassStyle: raw.bass_style as TrackAnalysis['bassStyle'] || { type: 'unknown', description: '' },
    harmonyStyle: raw.harmony_style as TrackAnalysis['harmonyStyle'] || { complexity: 'unknown', traits: [], description: '' },
    arrangementDensity: raw.arrangement_density as TrackAnalysis['arrangementDensity'] || {},
    vocalPresence: String(productionTexture.vocal_forwardness || 'unknown'),
    productionTexture,
    mixTraits: [],
    signatureArrangementMoves: stringArray(raw.signature_arrangement_moves),
    avoidElements: stringArray(raw.avoid_elements),
    sunoRelevantTraits: stringArray(raw.suno_relevant_traits),
    rawGoogleResponse: raw,
    createdAt: now,
  };
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll('files').filter((value): value is File => value instanceof File);
  const name = String(formData.get('name') || 'Style DNA').trim() || 'Style DNA';
  const instrumental = String(formData.get('instrumental') || 'false') === 'true';

  if (files.length < 1) return NextResponse.json({ error: 'Upload at least one reference track' }, { status: 400 });
  if (files.length > MAX_TRACKS) return NextResponse.json({ error: `Upload no more than ${MAX_TRACKS} tracks` }, { status: 400 });

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Only MP3/WAV audio is supported' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Each file must be 50MB or smaller' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const jobId = createId('style-job');
  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const provider = new GoogleAudioAnalysisProvider();

  await repo.createJob({ id: jobId, userId: user.id, name, now });
  await repo.updateJobStatus(jobId, user.id, 'analyzing');

  try {
    const analyses: TrackAnalysis[] = [];

    for (const file of files) {
      const sourceTrackId = createId('style-track');
      const ext = file.name.split('.').pop() || 'mp3';
      const storagePath = `${user.id}/style-dna/${jobId}/${sourceTrackId}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage.from('generations').upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage.from('generations').getPublicUrl(storagePath);
      await repo.createSourceTrack({
        id: sourceTrackId,
        job_id: jobId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        status: 'analyzing',
        created_at: now,
      });

      const raw = await provider.analyzeTrack({ audioBase64: buffer.toString('base64'), mimeType: file.type });
      const analysis = toTrackAnalysis(raw, sourceTrackId, file.name, now);
      analyses.push(analysis);

      await repo.createTrackAnalysis({
        id: analysis.id,
        job_id: jobId,
        source_track_id: sourceTrackId,
        user_id: user.id,
        title: analysis.title,
        duration: analysis.duration,
        confidence: analysis.confidence,
        bpm_estimate: analysis.bpmEstimate,
        bpm_range: analysis.bpmRange,
        key_estimate: analysis.keyEstimate,
        mode: analysis.mode,
        genre_candidates: analysis.genreCandidates,
        mood_tags: analysis.moodTags,
        energy_curve: analysis.energyCurve,
        section_map: analysis.sectionMap,
        instrumentation: analysis.instrumentation,
        drum_style: analysis.drumStyle,
        bass_style: analysis.bassStyle,
        harmony_style: analysis.harmonyStyle,
        arrangement_density: analysis.arrangementDensity,
        vocal_presence: analysis.vocalPresence,
        production_texture: analysis.productionTexture,
        mix_traits: analysis.mixTraits,
        signature_arrangement_moves: analysis.signatureArrangementMoves,
        avoid_elements: analysis.avoidElements,
        raw_google_response: analysis.rawGoogleResponse,
        created_at: now,
      });
    }

    await repo.updateJobStatus(jobId, user.id, 'aggregating');
    const dna = aggregateStyleDnaLocally(createId('style-dna'), name, analyses, now);
    const pkg = composeSunoPromptPackage(dna, { id: createId('suno-pkg'), title: name, instrumental, createdAt: now });

    await repo.createStyleDna({
      id: dna.id,
      job_id: jobId,
      user_id: user.id,
      name: dna.name,
      source_track_ids: dna.sourceTrackIds,
      summary: dna.summary,
      genre: dna.genre,
      tempo_range: dna.tempoRange,
      key_mood: dna.keyMood,
      primary_instruments: dna.primaryInstruments,
      secondary_instruments: dna.secondaryInstruments,
      drum_pattern: dna.drumPattern,
      bass_pattern: dna.bassPattern,
      harmony_language: dna.harmonyLanguage,
      arrangement_formula: dna.arrangementFormula,
      section_structure: dna.sectionStructure,
      production_texture: dna.productionTexture,
      emotional_arc: dna.emotionalArc,
      chinese_pop_specific_traits: dna.chinesePopSpecificTraits,
      suno_friendly_style_tags: dna.sunoFriendlyStyleTags,
      avoid_tags: dna.avoidTags,
      high_frequency_traits: dna.highFrequencyTraits,
      low_frequency_traits: dna.lowFrequencyTraits,
      uncertain_traits: dna.uncertainTraits,
      confidence: dna.confidence,
      version: dna.version,
      created_at: dna.createdAt,
      updated_at: dna.updatedAt,
    });

    await repo.createPromptPackage({
      id: pkg.id,
      style_dna_id: dna.id,
      job_id: jobId,
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

    await repo.updateJobStatus(jobId, user.id, 'prompt_ready');
    return NextResponse.json({ jobId, styleDna: dna, promptPackage: pkg, analyses });
  } catch (error: any) {
    await repo.updateJobStatus(jobId, user.id, 'failed', error?.message || 'Style DNA analysis failed');
    return NextResponse.json({ error: error?.message || 'Style DNA analysis failed', jobId }, { status: 500 });
  }
}

