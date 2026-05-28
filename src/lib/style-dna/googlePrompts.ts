import type { TrackAnalysis } from '@/types/style-dna';

export const TRACK_ANALYSIS_JSON_PROMPT = `You are a professional music arranger, producer, and music information retrieval analyst.

Analyze the uploaded reference track. Do not imitate any specific artist. Do not write a Suno prompt yet.

Return strict JSON only. No markdown. No commentary.

Focus on arrangement, production, instrumentation, rhythm, harmony, structure, and emotional development.

Schema:
{
  "track_summary": "short neutral description of the song",
  "confidence": 0.0,
  "estimated_bpm": 0,
  "bpm_range": "string",
  "estimated_key": "string or unknown",
  "mode": "major | minor | modal | unknown",
  "genre_candidates": ["string"],
  "mood_tags": ["string"],
  "energy_curve": {
    "intro": "low | medium | high | unknown",
    "verse": "low | medium | high | unknown",
    "pre_chorus": "low | medium | high | unknown",
    "chorus": "low | medium | high | unknown",
    "bridge": "low | medium | high | unknown",
    "final_chorus": "low | medium | high | unknown"
  },
  "section_map": [
    {
      "section": "Intro | Verse | Pre-Chorus | Chorus | Bridge | Outro | Unknown",
      "start_time": "mm:ss or unknown",
      "end_time": "mm:ss or unknown",
      "arrangement_notes": "string"
    }
  ],
  "instrumentation": {
    "primary": ["piano", "acoustic guitar", "electric guitar", "strings", "pad", "synth", "drums", "bass", "other"],
    "secondary": ["string"],
    "notable_absent_elements": ["string"]
  },
  "drum_style": {
    "type": "live drums | electronic drums | hybrid | percussion only | minimal | unknown",
    "density": "low | medium | high | unknown",
    "description": "string"
  },
  "bass_style": {
    "type": "electric bass | synth bass | 808 | acoustic bass | minimal | unknown",
    "description": "string"
  },
  "harmony_style": {
    "complexity": "simple | moderate | rich | unknown",
    "traits": ["seventh chords", "passing chords", "secondary dominants", "modal color", "diatonic pop chords", "unknown"],
    "description": "string"
  },
  "arrangement_density": {
    "verse": "sparse | medium | dense | unknown",
    "chorus": "sparse | medium | dense | unknown",
    "final_chorus": "sparse | medium | dense | unknown"
  },
  "production_texture": {
    "overall": "clean | warm | dark | bright | cinematic | lo-fi | glossy | organic | electronic | unknown",
    "reverb": "dry | medium | wide | unknown",
    "stereo_width": "narrow | medium | wide | unknown",
    "vocal_forwardness": "low | medium | high | unknown"
  },
  "signature_arrangement_moves": ["specific reusable arrangement traits, not artist names"],
  "suno_relevant_traits": ["short phrases that would help a text-to-music model understand the style"],
  "avoid_elements": ["elements that should be avoided when recreating the broad style"]
}

Rules:
- Do not mention copyrighted artist names.
- Do not claim certainty when unsure.
- Prefer reusable musical traits over subjective praise.
- Be specific about instruments, rhythm, density, and section development.
- If a value cannot be inferred, use "unknown" instead of guessing.`;

export function buildStyleDnaAggregationPrompt(analyses: TrackAnalysis[]) {
  return `You are a senior music producer and prompt engineer for text-to-music generation.

You will receive multiple structured track analyses. Your job is to extract the shared style DNA.

Do not imitate any specific artist. Do not mention artist names. Do not mention song titles in the final style description.

Return strict JSON only.

Schema:
{
  "summary": "one paragraph describing the shared musical identity",
  "confidence": 0.0,
  "genre": ["string"],
  "tempo_range": "string",
  "key_mood": "string",
  "primary_instruments": ["string"],
  "secondary_instruments": ["string"],
  "drum_pattern": "string",
  "bass_pattern": "string",
  "harmony_language": "string",
  "arrangement_formula": {
    "intro": "string",
    "verse": "string",
    "pre_chorus": "string",
    "chorus": "string",
    "bridge": "string",
    "final_chorus": "string"
  },
  "production_texture": "string",
  "emotional_arc": "string",
  "suno_friendly_style_tags": ["string"],
  "avoid_tags": ["string"],
  "high_frequency_traits": ["string"],
  "low_frequency_traits": ["string"],
  "uncertain_traits": ["string"]
}

Input analyses:
${JSON.stringify(analyses, null, 2)}`;
}

