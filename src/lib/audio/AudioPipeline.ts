// lib/audio/AudioPipeline.ts - 音频后处理流水线
import { AudioProcessor } from './AudioProcessor';
import type { GenerationDuration, AudioProcessingResult, AudioProcessingError } from '../../types/audio';

/**
 * AudioPipeline - 自动执行完整音频后处理流程
 *
 * 需求 10.8: Generation_Task 完成后自动触发，用户无需手动操作
 * 需求 10.10: FFmpeg 失败时记录错误日志，返回提示，保留原始音频文件
 *
 * 流程：判断裁剪/拼接 → 淡入淡出 → 输出
 */
export class AudioPipeline {
  private processor: AudioProcessor;

  constructor(processor?: AudioProcessor) {
    this.processor = processor ?? new AudioProcessor();
  }

  /**
   * 处理 AI 生成的音频文件
   * 自动执行完整后处理流程：
   * 1. 探测原始音频时长
   * 2. 根据原始时长与目标时长的关系，选择裁剪或拼接
   * 3. 添加淡入淡出效果
   * 4. 返回处理结果
   */
  async processGeneratedAudio(
    inputPath: string,
    targetDuration: GenerationDuration
  ): Promise<AudioProcessingResult | AudioProcessingError> {
    try {
      // 1. 探测原始音频信息
      const probe = await this.processor.probeAudio(inputPath);

      // 2. 裁剪或拼接
      let intermediateFile: string;
      if (probe.duration >= targetDuration) {
        // 原始音频 >= 目标时长：直接裁剪（需求 10.3）
        intermediateFile = await this.processor.trimAudio(inputPath, targetDuration);
      } else {
        // 原始音频 < 目标时长：拼接后裁剪（需求 10.4, 10.5）
        intermediateFile = await this.processor.concatenateAudio(inputPath, targetDuration);
      }

      // 3. 添加淡入淡出效果（需求 10.6, 10.7）
      const outputPath = await this.processor.applyFadeEffects(intermediateFile);

      // 4. 返回处理结果（需求 10.9: 保持采样率和声道数）
      return {
        success: true,
        outputPath,
        duration: targetDuration,
        sampleRate: probe.sampleRate,
        channels: probe.channels,
      };
    } catch (error) {
      // 需求 10.10: 记录错误日志，返回提示，保留原始音频文件
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AudioPipeline] 音频处理失败: ${errorMessage}`, { inputPath, targetDuration });

      return {
        code: 'PROCESSING_FAILED',
        message: '音频处理失败，请重试',
        originalFilePath: inputPath,
      };
    }
  }
}
