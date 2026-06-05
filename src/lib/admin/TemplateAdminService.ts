// lib/admin/TemplateAdminService.ts - admin template audio analysis service.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  CachedTemplateAnalysis,
  ManualTemplateAnalysis,
} from '../../types/template';
import type { TemplateAnalysisResult } from '../../types/generation';
import { toAppError } from '../supabase/errors';

const MAX_TEMPLATE_ANALYSIS_CHARS = 1000;

export type TemplateAnalysisKind = 'lyria3' | 'suno';

const LYRIA_ANALYSIS_PROMPT = `请详细分析这段音乐，用于音乐制作参考。请用中文输出分析结果，同时在最后附上一段英文的 AI 音乐生成 prompt。

请包含以下内容：
1. 🎵 流派与子流派
2. ⏱️ BPM（速度）
3. 🎹 调性与音阶
4. 🎸 主要使用的乐器
5. 🌙 情绪与氛围
6. 📐 歌曲结构（前奏、主歌、副歌等）
7. 🔧 值得注意的制作技巧
8. ⚡ 整体能量水平

最后，请用英文输出一段简洁的音乐生成 prompt，格式如下：
[PROMPT] A [genre] track at [BPM] BPM in [key], featuring [instruments], with a [mood] atmosphere. [structure details]. Instrumental only. [/PROMPT]`;

const SUNO_ANALYSIS_PROMPT = `Analyze this reference music and create a SUNO-ready music generation description.
Requirements:
1. Only analyze arrangement and production. Do not analyze vocals, singer, voice, lyrics, lyric meaning, or singing style.
2. Focus on genre/subgenre, tempo or BPM range, key/scale if detectable, core instruments, drum groove, bassline, chord or riff motifs, section structure, sound design, mix texture, mood, and energy changes.
3. First output one concise Chinese arrangement analysis, under 600 Chinese characters.
4. Then output one direct English SUNO style description inside [PROMPT]...[/PROMPT], 650-900 characters.
5. The SUNO style description must only describe music and arrangement. Do not include vocal, singer, voice, lyrics, male/female vocal, rap, spoken word, or topline requests.
6. Preserve musical accuracy by prioritizing, in order: genre/subgenre, BPM/tempo, key/scale, drums, bass, core instruments, harmonic/melodic motifs, section structure, sound design, mix texture, mood, and energy arc.
7. Keep it dense and concrete with compact comma-separated phrases; remove filler, disclaimers, and explanations instead of dropping musical details.
Format:
Arrangement analysis: ...
[PROMPT] concise SUNO style description here [/PROMPT]`;

const ANALYSIS_PROMPT = LYRIA_ANALYSIS_PROMPT;

interface StoredAudio {
  audioBase64: string;
  mimeType: string;
  analysisKind: TemplateAnalysisKind;
}

export type GeminiAnalyzeFn = (
  audioBase64: string,
  mimeType: string,
  prompt: string,
) => Promise<string>;

export class TemplateAdminService {
  private supabase: SupabaseClient<Database>;
  private audioStore = new Map<string, StoredAudio>();
  private geminiAnalyze: GeminiAnalyzeFn;

  constructor(supabase: SupabaseClient<Database>, geminiAnalyze?: GeminiAnalyzeFn) {
    this.supabase = supabase;
    this.geminiAnalyze = geminiAnalyze ?? defaultGeminiAnalyze;
  }

  async analyzeTemplate(
    templateId: string,
    audioBase64: string,
    mimeType: string,
    analysisKind: TemplateAnalysisKind = 'lyria3',
  ): Promise<TemplateAnalysisResult> {
    this.audioStore.set(templateId, { audioBase64, mimeType, analysisKind });

    const statusPatch = getStatusPatch(analysisKind, 'analyzing');
    const { error: statusError } = await this.supabase
      .from('templates')
      .update({
        ...statusPatch,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', templateId);

    if (statusError) throw toAppError(statusError, 'templates', 'update');

    try {
      const fullAnalysis = await this.geminiAnalyze(
        audioBase64,
        mimeType,
        getAnalysisPrompt(analysisKind),
      );

      const result = parseAnalysisResponse(
        fullAnalysis,
        analysisKind === 'suno' ? MAX_TEMPLATE_ANALYSIS_CHARS : undefined,
      );
      const now = new Date();

      const { error: updateError } = await this.supabase
        .from('templates')
        .update({
          ...getResultPatch(analysisKind, result.analysisDisplay, result.lyriaPrompt, now),
          updated_at: now.toISOString(),
        } as any)
        .eq('id', templateId);

      if (updateError) throw toAppError(updateError, 'templates', 'update');

      return { ...result, analyzedAt: now };
    } catch (error) {
      await this.supabase
        .from('templates')
        .update({
          ...getStatusPatch(analysisKind, 'failed'),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', templateId);

      throw error;
    }
  }

  async reAnalyzeTemplate(
    templateId: string,
    analysisKind?: TemplateAnalysisKind,
  ): Promise<TemplateAnalysisResult> {
    const stored = this.audioStore.get(templateId);
    if (!stored) {
      throw new Error(`模板 ${templateId} 的音频数据不存在，无法重新分析`);
    }

    return this.analyzeTemplate(
      templateId,
      stored.audioBase64,
      stored.mimeType,
      analysisKind ?? stored.analysisKind,
    );
  }

  async updateAnalysisManually(
    templateId: string,
    analysis: ManualTemplateAnalysis,
  ): Promise<void> {
    const now = new Date();

    const { error } = await this.supabase
      .from('templates')
      .update({
        analysis_result: analysis.analysisResult ?? '',
        lyria_prompt: analysis.lyriaPrompt,
        analyzed_at: now.toISOString(),
        analysis_status: 'completed' as const,
        updated_at: now.toISOString(),
      } as any)
      .eq('id', templateId);

    if (error) throw toAppError(error, 'templates', 'update');
  }

  async getCachedAnalysis(
    templateId: string,
  ): Promise<CachedTemplateAnalysis | null> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('id, analysis_result, lyria_prompt, analyzed_at, analysis_status')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw toAppError(error, 'templates', 'select');
    }

    if (!data.analysis_result && !data.lyria_prompt && data.analysis_status === 'pending') {
      return null;
    }

    return {
      templateId: data.id,
      analysisResult: data.analysis_result ?? '',
      lyriaPrompt: data.lyria_prompt ?? '',
      analyzedAt: data.analyzed_at ? new Date(data.analyzed_at) : new Date(),
      status: data.analysis_status,
    };
  }
}

function getAnalysisPrompt(analysisKind: TemplateAnalysisKind) {
  return analysisKind === 'suno' ? SUNO_ANALYSIS_PROMPT : LYRIA_ANALYSIS_PROMPT;
}

function getStatusPatch(analysisKind: TemplateAnalysisKind, status: 'analyzing' | 'completed' | 'failed') {
  return analysisKind === 'suno'
    ? { suno_analysis_status: status }
    : { analysis_status: status };
}

function getResultPatch(
  analysisKind: TemplateAnalysisKind,
  analysisDisplay: string,
  prompt: string,
  now: Date,
) {
  if (analysisKind === 'suno') {
    return {
      suno_analysis_result: analysisDisplay,
      suno_prompt: prompt,
      suno_analyzed_at: now.toISOString(),
      suno_analysis_status: 'completed' as const,
    };
  }

  return {
    analysis_result: analysisDisplay,
    lyria_prompt: prompt,
    analyzed_at: now.toISOString(),
    analysis_status: 'completed' as const,
  };
}

function parseAnalysisResponse(
  fullAnalysis: string,
  maxChars?: number,
): {
  analysisDisplay: string;
  lyriaPrompt: string;
} {
  const promptMatch = fullAnalysis.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
  if (promptMatch) {
    const rawPrompt = promptMatch[1].trim();
    const rawAnalysis = fullAnalysis.replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/, '').trim();
    return {
      analysisDisplay: maxChars ? truncateText(rawAnalysis, maxChars) : normalizeAnalysisText(rawAnalysis),
      lyriaPrompt: maxChars ? truncateText(rawPrompt, maxChars) : normalizeAnalysisText(rawPrompt),
    };
  }

  const trimmed = fullAnalysis.trim();
  const value = maxChars ? truncateText(trimmed, maxChars) : normalizeAnalysisText(trimmed);
  return { analysisDisplay: value, lyriaPrompt: value };
}

function normalizeAnalysisText(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function truncateText(text: string, maxChars: number) {
  const normalized = normalizeAnalysisText(text);
  const chars = Array.from(normalized);
  if (chars.length <= maxChars) return normalized;
  return trimAtMusicalBoundary(normalized, maxChars);
}

function trimAtMusicalBoundary(text: string, maxChars: number) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  const limited = chars.slice(0, maxChars).join('');
  const boundary = Math.max(
    limited.lastIndexOf('. '),
    limited.lastIndexOf('; '),
    limited.lastIndexOf(', '),
    limited.lastIndexOf('，'),
    limited.lastIndexOf('。'),
  );
  if (boundary >= Math.floor(maxChars * 0.82)) {
    return limited.slice(0, boundary + 1).trim();
  }
  return limited.trim();
}

const defaultGeminiAnalyze: GeminiAnalyzeFn = async (
  audioBase64,
  mimeType,
  prompt,
) => {
  const { GoogleGenAI } = await import('@google/genai');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts;
  let fullText = '';
  if (parts) {
    for (const part of parts) {
      if (part.text) fullText += part.text;
    }
  }

  if (!fullText) {
    throw new Error('Gemini LLM returned no analysis result');
  }

  return fullText;
};

export {
  ANALYSIS_PROMPT,
  LYRIA_ANALYSIS_PROMPT,
  SUNO_ANALYSIS_PROMPT,
  MAX_TEMPLATE_ANALYSIS_CHARS,
  parseAnalysisResponse,
};
