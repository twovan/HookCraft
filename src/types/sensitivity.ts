// types/sensitivity.ts - 敏感词拦截与智能提示词改写类型定义

/** 敏感词分类 */
export type SensitiveWordCategory = 'celebrity' | 'song_name' | 'forbidden';

/** 检测结果类型 */
export type SensitivityResultType = 'pass' | 'rewrite' | 'block';

/** 敏感词条目 */
export interface SensitiveWordEntry {
  id: string;
  word: string;
  category: SensitiveWordCategory;
  variants: string[];
  note: string;
  hitCount: number;
  lastHitAt: string | null;
  cachedRewrite: CachedRewrite | null;
  createdAt: string;
  updatedAt: string;
}

/** 缓存的改写结果 */
export interface CachedRewrite {
  rewrittenPrompt: string;
  styleTags: string[];
  styleTagsCn: string[];
}

/** 检测请求输入 */
export interface SensitivityCheckInput {
  description: string;       // 创作描述
  lyrics?: string;           // 自定义歌词（可选）
}

/** 检测结果 */
export interface SensitivityCheckResult {
  passed: boolean;
  resultType: SensitivityResultType;
  descriptionResult: DescriptionCheckResult | null;
  lyricsResult: LyricsCheckResult | null;
  rewrittenPrompt: string | null;
  styleTags: string[] | null;
  styleTagsCn: string[] | null;
  blockedWords: string[] | null;
  durationMs: number;
}

/** 创作描述检测结果 */
export interface DescriptionCheckResult {
  type: SensitivityResultType;
  detectedWords: DetectedWord[];
}

/** 歌词检测结果 */
export interface LyricsCheckResult {
  type: 'pass' | 'block';
  detectedWords: DetectedWord[];
}

/** 检测到的敏感词 */
export interface DetectedWord {
  word: string;
  category: SensitiveWordCategory;
  source: 'local' | 'gemini';
}

/** 本地匹配结果 */
export interface LocalMatchResult {
  matched: boolean;
  words: Array<{
    word: string;
    category: SensitiveWordCategory;
    matchedVariant?: string;  // 实际匹配到的变体
    id?: string;              // 敏感词条目 ID（用于更新缓存）
    cachedRewrite?: CachedRewrite | null;  // 缓存的改写结果
  }>;
}

/** Gemini 检测+改写输入 */
export interface DetectAndRewriteInput {
  description: string;
  knownSensitiveWords?: string[];  // 本地已匹配到的词（辅助 Gemini）
}

/** Gemini 检测+改写结果 */
export interface DetectAndRewriteResult {
  hasSensitiveContent: boolean;
  detectedWords: Array<{
    word: string;
    category: SensitiveWordCategory;
  }>;
  rewrittenPrompt: string | null;
  styleTags: string[] | null;
  styleTagsCn: string[] | null;
  hasForbiddenWords: boolean;
  forbiddenWords: string[];
}

/** 仅改写输入 */
export interface RewriteOnlyInput {
  description: string;
  sensitiveWords: string[];
}

/** 改写结果 */
export interface RewriteResult {
  rewrittenPrompt: string;
  styleTags: string[];
  styleTagsCn: string[];
}

/** 检测日志条目 */
export interface SensitivityLogEntry {
  userId: string;
  inputDescription: string;
  inputLyrics?: string;
  resultType: SensitivityResultType;
  detectedWords: DetectedWord[];
  rewrittenPrompt?: string;
  styleTags?: string[];
  userConfirmed?: boolean;
  detectionSource: 'local' | 'gemini' | 'both';
  durationMs: number;
}


/** 日志查询参数 */
export interface LogQueryParams {
  page?: number;
  pageSize?: number;
  resultType?: SensitivityResultType;
}

/** 检测日志记录（数据库返回） */
export interface SensitivityLog {
  id: string;
  userId: string | null;
  inputDescription: string;
  inputLyrics: string | null;
  resultType: SensitivityResultType;
  detectedWords: DetectedWord[];
  rewrittenPrompt: string | null;
  styleTags: string[];
  userConfirmed: boolean | null;
  detectionSource: string | null;
  durationMs: number | null;
  createdAt: string;
}
