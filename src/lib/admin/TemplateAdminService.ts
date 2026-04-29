// lib/admin/TemplateAdminService.ts - 管理员模板预分析服务（Supabase 版）
//
// 管理员上传模板时，调用 Gemini LLM 分析参考音频，
// 提取 Genre、Instruments、BPM、Key/Scale、Mood、Structure，
// 生成中文分析描述 + 英文 Lyria Prompt，结果持久化到 templates 表。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  CachedTemplateAnalysis,
  ManualTemplateAnalysis,
} from '../../types/template';
import type { TemplateAnalysisResult } from '../../types/generation';
import { toAppError } from '../supabase/errors';

/** Gemini 分析音频的 prompt（与 demo route.ts 保持一致） */
const ANALYSIS_PROMPT = `请详细分析这段音乐，用于音乐制作参考。请用中文输出分析结果，同时在最后附上一段英文的 AI 音乐生成 prompt。

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

/** 存储的音频数据（用于 reAnalyze） */
interface StoredAudio {
  audioBase64: string;
  mimeType: string;
}

/**
 * Gemini LLM 调用函数签名。
 * 生产环境使用真实 Gemini API，测试时可注入 mock。
 */
export type GeminiAnalyzeFn = (
  audioBase64: string,
  mimeType: string,
  prompt: string,
) => Promise<string>;

/**
 * TemplateAdminService - 管理员模板预分析服务
 *
 * 负责：
 * - 调用 Gemini LLM 分析参考音频
 * - 将分析结果持久化到 templates 表（analysis_result、lyria_prompt、analyzed_at、analysis_status）
 * - 支持重新分析、手动填写
 *
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 */
export class TemplateAdminService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  /** 音频数据存储（用于 reAnalyze，仍保留内存存储因为音频数据不适合存数据库） */
  private audioStore = new Map<string, StoredAudio>();

  /** Gemini LLM 调用函数（可注入 mock） */
  private geminiAnalyze: GeminiAnalyzeFn;

  constructor(supabase: SupabaseClient<Database>, geminiAnalyze?: GeminiAnalyzeFn) {
    this.supabase = supabase;
    this.geminiAnalyze = geminiAnalyze ?? defaultGeminiAnalyze;
  }

  /**
   * 管理员上传模板时，调用 Gemini LLM 分析参考音频。
   * 提取中文分析描述 + 英文 Lyria Prompt，结果更新到 templates 表。
   *
   * @param templateId 模板 ID
   * @param audioBase64 音频 Base64 编码
   * @param mimeType 音频 MIME 类型（如 "audio/mp3"、"audio/wav"）
   * @returns TemplateAnalysisResult
   * @throws 当 Gemini 分析失败时抛出错误（管理员可手动填写或重试）
   */
  async analyzeTemplate(
    templateId: string,
    audioBase64: string,
    mimeType: string,
  ): Promise<TemplateAnalysisResult> {
    // 存储音频数据，供 reAnalyze 使用
    this.audioStore.set(templateId, { audioBase64, mimeType });

    // 更新状态为 analyzing
    const { error: statusError } = await this.supabase
      .from('templates')
      .update({
        analysis_status: 'analyzing' as const,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (statusError) throw toAppError(statusError, 'templates', 'update');

    try {
      const fullAnalysis = await this.geminiAnalyze(
        audioBase64,
        mimeType,
        ANALYSIS_PROMPT,
      );

      const result = parseAnalysisResponse(fullAnalysis);
      const now = new Date();

      // 更新 templates 表的分析字段
      const { error: updateError } = await this.supabase
        .from('templates')
        .update({
          analysis_result: result.analysisDisplay,
          lyria_prompt: result.lyriaPrompt,
          analyzed_at: now.toISOString(),
          analysis_status: 'completed' as const,
          updated_at: now.toISOString(),
        })
        .eq('id', templateId);

      if (updateError) throw toAppError(updateError, 'templates', 'update');

      return { ...result, analyzedAt: now };
    } catch (error) {
      // 标记失败状态
      await this.supabase
        .from('templates')
        .update({
          analysis_status: 'failed' as const,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId);

      throw error;
    }
  }

  /**
   * 重新分析已有模板（管理员触发"重新分析"按钮）。
   * 使用之前存储的音频数据重新调用 Gemini LLM。
   *
   * @param templateId 模板 ID
   * @returns TemplateAnalysisResult
   * @throws 当模板音频数据不存在或 Gemini 分析失败时抛出错误
   */
  async reAnalyzeTemplate(templateId: string): Promise<TemplateAnalysisResult> {
    const stored = this.audioStore.get(templateId);
    if (!stored) {
      throw new Error(
        `模板 ${templateId} 的音频数据不存在，无法重新分析`,
      );
    }

    return this.analyzeTemplate(templateId, stored.audioBase64, stored.mimeType);
  }

  /**
   * 管理员手动填写/更新模板分析结果。
   * 用于 Gemini 分析失败时的备选方案。
   *
   * @param templateId 模板 ID
   * @param analysis 手动填写的分析内容（lyriaPrompt 必填，analysisResult 可选）
   */
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
      })
      .eq('id', templateId);

    if (error) throw toAppError(error, 'templates', 'update');
  }

  /**
   * 获取模板的缓存分析结果。
   * 从 templates 表查询分析相关字段。
   *
   * @param templateId 模板 ID
   * @returns CachedTemplateAnalysis 或 null（不存在或未分析时）
   */
  async getCachedAnalysis(
    templateId: string,
  ): Promise<CachedTemplateAnalysis | null> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('id, analysis_result, lyria_prompt, analyzed_at, analysis_status')
      .eq('id', templateId)
      .single();

    if (error) {
      // PGRST116 表示 "Row not found"，返回 null
      if (error.code === 'PGRST116') {
        return null;
      }
      throw toAppError(error, 'templates', 'select');
    }

    // 如果模板存在但尚未分析（status 为 pending 且无分析结果），返回 null
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

/**
 * 解析 Gemini LLM 的分析响应文本。
 * 提取 [PROMPT]...[/PROMPT] 标签中的英文 Lyria Prompt，
 * 其余部分作为中文分析描述。
 */
function parseAnalysisResponse(fullAnalysis: string): {
  analysisDisplay: string;
  lyriaPrompt: string;
} {
  const promptMatch = fullAnalysis.match(/\[PROMPT\]([\s\S]*?)\[\/PROMPT\]/);
  if (promptMatch) {
    const lyriaPrompt = promptMatch[1].trim();
    const analysisDisplay = fullAnalysis
      .replace(/\[PROMPT\][\s\S]*?\[\/PROMPT\]/, '')
      .trim();
    return { analysisDisplay, lyriaPrompt };
  }
  // 没有 [PROMPT] 标签时，整段文本同时作为分析和 prompt
  return { analysisDisplay: fullAnalysis, lyriaPrompt: fullAnalysis };
}

/**
 * 默认 Gemini LLM 调用实现（生产环境）。
 * 使用 @google/genai SDK 调用 gemini-3-flash-preview。
 */
const defaultGeminiAnalyze: GeminiAnalyzeFn = async (
  audioBase64,
  mimeType,
  prompt,
) => {
  const { GoogleGenAI } = await import('@google/genai');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 未配置');
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
    throw new Error('Gemini LLM 未返回分析结果');
  }

  return fullText;
};

export { ANALYSIS_PROMPT, parseAnalysisResponse };
