import { GoogleGenAI } from '@google/genai';
import type { TrackAnalysis } from '@/types/style-dna';
import { TRACK_ANALYSIS_JSON_PROMPT, buildStyleDnaAggregationPrompt } from './googlePrompts';
import { parseStrictJsonObject } from './jsonRepair';

export class GoogleAudioAnalysisProvider {
  private ai: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY || '') {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeTrack(input: { audioBase64: string; mimeType: string }) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
          { text: TRACK_ANALYSIS_JSON_PROMPT },
        ],
      }],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    return parseStrictJsonObject(text);
  }

  async aggregate(analyses: TrackAnalysis[]) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: buildStyleDnaAggregationPrompt(analyses) }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    return parseStrictJsonObject(text);
  }
}

