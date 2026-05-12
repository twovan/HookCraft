// types/generation.ts - AI 音乐生成类型定义（Lyria 3 + Gemini）

/** Lyria 3 模型 ID */
export type LyriaModelId = 'lyria-3-clip-preview' | 'lyria-3-pro-preview';

/** 生成类型 */
export type GenerationType = 'preview' | 'full_demo';

/** 音频输出格式（Lyria 3 支持） */
export type LyriaOutputFormat = 'audio/mpeg' | 'audio/wav';

/** 歌曲结构段落类型 */
export type SongSectionType = 'Intro' | 'Verse' | 'Chorus' | 'Bridge' | 'Outro';

/** 歌曲结构定义 */
export interface SongStructure {
  sections: SongSection[];
}

export interface SongSection {
  type: SongSectionType;
  label?: string;                  // 如 "Verse 1"、"Chorus"
  startTime?: string;              // 时间戳格式 "0:00"
  endTime?: string;                // 时间戳格式 "0:30"
  description?: string;            // 段落描述
}

/** 模板分析结果（Gemini LLM 输出，管理员上传时生成并缓存） */
export interface TemplateAnalysisResult {
  /** 中文分析描述（展示给管理员） */
  analysisDisplay: string;
  /** 英文 Lyria Prompt（直接用于 Lyria 3 生成） */
  lyriaPrompt: string;
  /** 分析时间 */
  analyzedAt: Date;
}

/** 音乐生成输入 */
export interface MusicGenerationInput {
  templateId?: string;             // 选择的模板 ID
  userPrompt?: string;             // 用户输入的 Prompt
  generationType: GenerationType;  // preview 或 full_demo
  outputFormat?: LyriaOutputFormat; // 输出格式（Full_Demo 可选 WAV）
  usePremiumSinger?: boolean;      // 是否使用高级声模
  images?: ImageInput[];           // 图片灵感输入（Pro/Business 限定，最多 10 张）
  customLyrics?: string;           // 自定义歌词
}

/** 图片输入 */
export interface ImageInput {
  data: string;                    // Base64 编码的图片数据
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** 生成请求（发送给 AIModelProvider） */
export interface GenerationRequest {
  prompt: string;                  // 最终构建的 Prompt 文本
  outputFormat: LyriaOutputFormat;
  images?: ImageInput[];
  generationConfig?: GeminiGenerationConfig;
}

/** Gemini API 生成配置 */
export interface GeminiGenerationConfig {
  responseModalities: string[];    // ["AUDIO", "TEXT"]
  responseMimeType?: string;       // "audio/wav" 用于 WAV 输出
}

/** 生成响应（AIModelProvider 返回） */
export interface GenerationResponse {
  success: boolean;
  audioData?: Buffer;              // 音频二进制数据
  audioMimeType?: string;          // "audio/mpeg" 或 "audio/wav"
  lyrics?: string;                 // 生成的歌词文本
  songStructureDescription?: string; // 歌曲结构 JSON 描述
  modelId: LyriaModelId;          // 使用的模型 ID
  hasSynthIdWatermark: boolean;    // SynthID 水印状态（始终为 true）
}

/** 音乐生成完整结果 */
export interface MusicGenerationResult {
  success: boolean;
  taskId: string;
  generationType: GenerationType;
  audioFilePath?: string;          // 后处理后的音频文件路径
  rawAudioFilePath?: string;       // 原始音频文件路径
  lyrics?: string;
  songStructure?: string;
  creditsConsumed: number;         // 实际消耗的 Credits
  modelId: LyriaModelId;
  hasSynthIdWatermark: boolean;
  error?: GenerationError;
}

/** 生成任务状态 */
export type GenerationTaskStatus =
  | 'pending'                      // 等待处理
  | 'building_prompt'              // 正在构建 Prompt（读取缓存/合并）
  | 'generating'                   // 正在生成音频（Lyria 3）
  | 'post_processing'              // 正在后处理（FFmpeg）
  | 'completed'                    // 完成
  | 'failed'                       // 失败
  | 'safety_blocked'               // 被安全过滤器拦截
  | 'selected'                     // 用户选中的版本
  | 'archived';                    // 未选中的版本（已归档）

/** 生成错误 */
export interface GenerationError {
  code: GenerationErrorCode;
  message: string;
  modelId?: LyriaModelId;
  requestId?: string;
}

export type GenerationErrorCode =
  | 'CACHED_ANALYSIS_MISSING'      // 模板缓存分析结果缺失或损坏
  | 'LYRIA_GENERATION_FAILED'      // Lyria 3 生成失败
  | 'LYRIA_TIMEOUT'                // Lyria 3 超时
  | 'SAFETY_FILTER_BLOCKED'        // 安全过滤器拦截
  | 'INVALID_PROMPT'               // 无效 Prompt
  | 'IMAGE_LIMIT_EXCEEDED'         // 图片数量超限（>10）
  | 'IMAGE_NOT_ALLOWED'            // Free 用户不允许图片输入
  | 'RESPONSE_PARSE_ERROR'         // 响应解析失败
  | 'GEMINI_ADMIN_ANALYSIS_FAILED'; // 管理员上传模板时 Gemini 分析失败

/** Gemini API 原始响应（内部使用） */
export interface GeminiRawResponse {
  candidates: Array<{
    content: {
      parts: Array<GeminiResponsePart>;
    };
  }>;
}

export type GeminiResponsePart =
  | { text: string; inlineData?: never }
  | { text?: never; inlineData: { mimeType: string; data: string } };

// ===== 多版本批量生成相关类型 =====

/** 批量生成请求 */
export interface GenerateBatchRequest {
  templateId?: string;
  userPrompt?: string;
  generationType: GenerationType;
  usePremiumSinger?: boolean;
  images?: ImageInput[];
}

/** 批量生成响应 */
export interface GenerateBatchResponse {
  batchId: string;
  versions: VersionResult[];
  totalCreditsConsumed: number;
}

/** 批量生成结果（服务层返回） */
export interface BatchGenerationResult {
  batchId: string;
  versions: VersionResult[];
  totalCreditsConsumed: number;
  status: 'completed' | 'partial' | 'failed';
}

/** 单个版本生成结果 */
export interface VersionResult {
  taskId: string;
  versionNumber: number;
  status: GenerationTaskStatus;
  audioUrl?: string;
  lyrics?: string;
  durationSeconds?: number;
  creditsConsumed: number;
  error?: { code: string; message: string };
}
