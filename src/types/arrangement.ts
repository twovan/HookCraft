// types/arrangement.ts - 上传音频生成编曲功能类型定义（MiniMax music-cover）

/** 音乐调性（12 个半音） */
export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

/** 音阶类型 */
export type MusicalScale = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'pentatonic';

/** 编曲时长选项（秒） */
export type ArrangementDuration = 30 | 60 | 90 | 120;

/** 音频输出格式 */
export type ArrangementOutputFormat = 'mp3' | 'wav';

/** 编曲参数 */
export interface ArrangementParams {
  duration: ArrangementDuration;
  bpm: number;                    // 60-200
  musicalKey: MusicalKey;
  scale: MusicalScale;
  instruments: string[];          // 1-10 个乐器
  prompt: string;                 // 风格描述，最大 2000 字符，可选
  lyrics: string;                 // 歌词，最大 3500 字符
  isInstrumental: boolean;        // 纯器乐模式
  outputFormat: ArrangementOutputFormat;
}

/** 音频设置（MiniMax API 参数） */
export interface AudioSetting {
  sampleRate: 16000 | 24000 | 32000 | 44100;
  bitrate: 32000 | 64000 | 128000 | 256000;
  format: ArrangementOutputFormat;
}

/** 预处理输入 */
export interface PreprocessInput {
  audioBase64: string;
  audioUrl?: string;
}

/** 预处理结果 */
export interface PreprocessResult {
  coverFeatureId: string;
  formattedLyrics: string;
  structureResult: string;
  audioDuration: number;
}

/** 编曲生成输入 */
export interface ArrangementGenerationInput {
  model: 'music-cover' | 'music-cover-free';
  coverFeatureId: string;
  lyrics: string;
  prompt?: string;
  isInstrumental: boolean;
  audioSetting: AudioSetting;
}

/** 编曲生成结果 */
export interface ArrangementGenerationResult {
  success: boolean;
  audioUrl?: string;
  audioHex?: string;
  taskId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/** 音频上传状态 */
export type UploadStatus = 'idle' | 'validating' | 'ready' | 'error';

/** 预处理状态 */
export type PreprocessStatus = 'idle' | 'processing' | 'completed' | 'error';

/** 生成状态 */
export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

/** AudioUploadTab 完整状态 */
export interface AudioUploadTabState {
  // 音频上传状态
  audioFile: File | null;
  audioBase64: string | null;
  audioDuration: number | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;

  // 预处理状态
  preprocessStatus: PreprocessStatus;
  coverFeatureId: string | null;
  extractedLyrics: string | null;
  structureResult: string | null;

  // 生成参数
  params: ArrangementParams;

  // 生成状态
  generationStatus: GenerationStatus;
  generationResult: ArrangementGenerationResult | null;
}

/** 音频文件校验结果 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  duration?: number;
}
