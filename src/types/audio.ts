// types/audio.ts - 音频处理相关类型定义

/** 生成时长（仅 30 秒和 2 分钟） */
export type GenerationDuration = 30 | 120;

/** 音频处理结果 */
export interface AudioProcessingResult {
  success: boolean;
  outputPath: string;
  duration: GenerationDuration;
  sampleRate: number;
  channels: number;
}

/** 音频处理错误 */
export interface AudioProcessingError {
  code: 'FFMPEG_ERROR' | 'FILE_NOT_FOUND' | 'INVALID_DURATION' | 'PROCESSING_FAILED';
  message: string;
  originalFilePath: string;   // 保留原始音频文件路径
}
