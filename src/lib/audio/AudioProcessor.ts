// lib/audio/AudioProcessor.ts - FFmpeg 音频后处理核心模块
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

/** 音频元信息（采样率、声道数、时长） */
export interface AudioProbeResult {
  duration: number;
  sampleRate: number;
  channels: number;
}

/**
 * AudioProcessor - 使用 FFmpeg CLI 进行音频后处理
 *
 * 需求 10.1-10.7, 10.9:
 * - 裁剪音频到目标时长（30s / 120s），从起始位置截取
 * - 原始音频不足目标时长时，智能拼接 + 500ms crossfade
 * - 添加 500ms 淡入 + 1000ms 淡出
 * - 保持采样率和声道数与原始音频一致
 */
export class AudioProcessor {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor(ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe') {
    this.ffmpegPath = ffmpegPath;
    this.ffprobePath = ffprobePath;
  }

  /**
   * 探测音频文件的元信息（时长、采样率、声道数）
   */
  async probeAudio(inputPath: string): Promise<AudioProbeResult> {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-show_entries', 'stream=sample_rate,channels',
      '-of', 'json',
      inputPath,
    ];

    const { stdout } = await execFileAsync(this.ffprobePath, args);
    const data = JSON.parse(stdout);

    const stream = data.streams?.[0] ?? {};
    const format = data.format ?? {};

    return {
      duration: parseFloat(format.duration ?? '0'),
      sampleRate: parseInt(stream.sample_rate ?? '44100', 10),
      channels: parseInt(stream.channels ?? '2', 10),
    };
  }

  /**
   * 裁剪音频到目标时长（从起始位置截取）
   * 需求 10.1, 10.2, 10.3
   */
  async trimAudio(inputPath: string, targetDuration: number): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_trimmed${ext}`);

    const probe = await this.probeAudio(inputPath);

    const args = [
      '-y',
      '-i', inputPath,
      '-t', String(targetDuration),
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];

    await execFileAsync(this.ffmpegPath, args);
    return outputPath;
  }

  /**
   * 拼接音频片段（原始音频不足目标时长时使用）
   * 通过循环拼接 + 500ms crossfade 达到目标时长，再裁剪
   * 需求 10.4, 10.5
   */
  async concatenateAudio(inputPath: string, targetDuration: number): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_concat${ext}`);

    const probe = await this.probeAudio(inputPath);
    const originalDuration = probe.duration;

    if (originalDuration <= 0) {
      throw new Error('Invalid audio duration: 0 or negative');
    }

    // 计算需要重复的次数（考虑 crossfade 会缩短总时长）
    const crossfadeDuration = 0.5; // 500ms
    const effectiveDuration = originalDuration - crossfadeDuration;
    const repeatsNeeded = Math.ceil(targetDuration / effectiveDuration) + 1;

    // 构建 FFmpeg 复杂滤镜：多次输入 + 逐步 crossfade
    const inputs: string[] = [];
    for (let i = 0; i < repeatsNeeded; i++) {
      inputs.push('-i', inputPath);
    }

    // 构建 acrossfade 滤镜链
    let filterComplex = '';
    if (repeatsNeeded === 2) {
      filterComplex = `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[merged]`;
    } else {
      // 逐步合并：先合并前两个，再依次合并后续
      filterComplex = `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[tmp1]`;
      for (let i = 2; i < repeatsNeeded; i++) {
        const prevLabel = i === 2 ? 'tmp1' : `tmp${i - 1}`;
        const nextLabel = i === repeatsNeeded - 1 ? 'merged' : `tmp${i}`;
        filterComplex += `;[${prevLabel}][${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[${nextLabel}]`;
      }
    }

    const args = [
      '-y',
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[merged]',
      '-t', String(targetDuration),
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];

    await execFileAsync(this.ffmpegPath, args);
    return outputPath;
  }

  /**
   * 添加淡入淡出效果
   * 需求 10.6, 10.7: 淡入 500ms，淡出 1000ms
   */
  async applyFadeEffects(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_faded${ext}`);

    const probe = await this.probeAudio(inputPath);
    const fadeInDuration = 0.5;  // 500ms
    const fadeOutDuration = 1.0; // 1000ms
    const fadeOutStart = probe.duration - fadeOutDuration;

    const filterStr = `afade=t=in:st=0:d=${fadeInDuration},afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`;

    const args = [
      '-y',
      '-i', inputPath,
      '-af', filterStr,
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];

    await execFileAsync(this.ffmpegPath, args);
    return outputPath;
  }

  /** 构建 trimAudio 的 FFmpeg 参数（用于测试） */
  buildTrimArgs(inputPath: string, targetDuration: number, probe: AudioProbeResult): string[] {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_trimmed${ext}`);
    return [
      '-y',
      '-i', inputPath,
      '-t', String(targetDuration),
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];
  }

  /** 构建 concatenateAudio 的 FFmpeg 参数（用于测试） */
  buildConcatenateArgs(inputPath: string, targetDuration: number, probe: AudioProbeResult): string[] {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_concat${ext}`);
    const originalDuration = probe.duration;
    const crossfadeDuration = 0.5;
    const effectiveDuration = originalDuration - crossfadeDuration;
    const repeatsNeeded = Math.ceil(targetDuration / effectiveDuration) + 1;

    const inputs: string[] = [];
    for (let i = 0; i < repeatsNeeded; i++) {
      inputs.push('-i', inputPath);
    }

    let filterComplex = '';
    if (repeatsNeeded === 2) {
      filterComplex = `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[merged]`;
    } else {
      filterComplex = `[0:a][1:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[tmp1]`;
      for (let i = 2; i < repeatsNeeded; i++) {
        const prevLabel = i === 2 ? 'tmp1' : `tmp${i - 1}`;
        const nextLabel = i === repeatsNeeded - 1 ? 'merged' : `tmp${i}`;
        filterComplex += `;[${prevLabel}][${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[${nextLabel}]`;
      }
    }

    return [
      '-y',
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[merged]',
      '-t', String(targetDuration),
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];
  }

  /** 构建 applyFadeEffects 的 FFmpeg 参数（用于测试） */
  buildFadeArgs(inputPath: string, probe: AudioProbeResult): string[] {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `_faded${ext}`);
    const fadeInDuration = 0.5;
    const fadeOutDuration = 1.0;
    const fadeOutStart = probe.duration - fadeOutDuration;

    const filterStr = `afade=t=in:st=0:d=${fadeInDuration},afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`;

    return [
      '-y',
      '-i', inputPath,
      '-af', filterStr,
      '-ar', String(probe.sampleRate),
      '-ac', String(probe.channels),
      outputPath,
    ];
  }
}
