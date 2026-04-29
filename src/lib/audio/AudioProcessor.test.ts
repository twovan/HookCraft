// AudioProcessor & AudioPipeline 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioProcessor } from './AudioProcessor';
import { AudioPipeline } from './AudioPipeline';
import type { AudioProbeResult } from './AudioProcessor';
import type { AudioProcessingResult, AudioProcessingError } from '../../types/audio';

// ─── Mock child_process.execFile ──────────────────────────
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: Function) => {
      // Return a function that calls the mock and returns a promise
      return (...args: unknown[]) => {
        return new Promise((resolve, reject) => {
          fn(...args, (err: Error | null, result: unknown) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };
    },
  };
});

import { execFile } from 'child_process';
const mockExecFile = vi.mocked(execFile);

describe('AudioProcessor', () => {
  let processor: AudioProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new AudioProcessor();
  });

  // ─── buildTrimArgs ──────────────────────────────────────

  describe('buildTrimArgs - 裁剪命令构建', () => {
    it('构建 30 秒裁剪的正确 FFmpeg 参数', () => {
      const probe: AudioProbeResult = { duration: 45, sampleRate: 44100, channels: 2 };
      const args = processor.buildTrimArgs('/tmp/audio.mp3', 30, probe);

      expect(args).toContain('-y');
      expect(args).toContain('-i');
      expect(args).toContain('/tmp/audio.mp3');
      expect(args).toContain('-t');
      expect(args).toContain('30');
      expect(args).toContain('-ar');
      expect(args).toContain('44100');
      expect(args).toContain('-ac');
      expect(args).toContain('2');
      expect(args[args.length - 1]).toBe('/tmp/audio_trimmed.mp3');
    });

    it('构建 120 秒裁剪的正确 FFmpeg 参数', () => {
      const probe: AudioProbeResult = { duration: 180, sampleRate: 48000, channels: 1 };
      const args = processor.buildTrimArgs('/tmp/song.wav', 120, probe);

      expect(args).toContain('120');
      expect(args).toContain('48000');
      expect(args).toContain('1');
      expect(args[args.length - 1]).toBe('/tmp/song_trimmed.wav');
    });

    it('保持原始采样率和声道数（需求 10.9）', () => {
      const probe: AudioProbeResult = { duration: 60, sampleRate: 96000, channels: 6 };
      const args = processor.buildTrimArgs('/tmp/hires.wav', 30, probe);

      const arIdx = args.indexOf('-ar');
      const acIdx = args.indexOf('-ac');
      expect(args[arIdx + 1]).toBe('96000');
      expect(args[acIdx + 1]).toBe('6');
    });
  });

  // ─── buildConcatenateArgs ───────────────────────────────

  describe('buildConcatenateArgs - 拼接命令构建', () => {
    it('短音频拼接包含 crossfade 滤镜（需求 10.5）', () => {
      const probe: AudioProbeResult = { duration: 10, sampleRate: 44100, channels: 2 };
      const args = processor.buildConcatenateArgs('/tmp/short.mp3', 30, probe);

      expect(args).toContain('-filter_complex');
      const filterIdx = args.indexOf('-filter_complex');
      const filterStr = args[filterIdx + 1];
      expect(filterStr).toContain('acrossfade');
      expect(filterStr).toContain('d=0.5');
    });

    it('拼接后裁剪到精确目标时长', () => {
      const probe: AudioProbeResult = { duration: 10, sampleRate: 44100, channels: 2 };
      const args = processor.buildConcatenateArgs('/tmp/short.mp3', 120, probe);

      expect(args).toContain('-t');
      const tIdx = args.indexOf('-t');
      expect(args[tIdx + 1]).toBe('120');
    });

    it('输出文件名包含 _concat 后缀', () => {
      const probe: AudioProbeResult = { duration: 15, sampleRate: 44100, channels: 2 };
      const args = processor.buildConcatenateArgs('/tmp/audio.mp3', 30, probe);

      expect(args[args.length - 1]).toBe('/tmp/audio_concat.mp3');
    });

    it('多次输入用于循环拼接', () => {
      const probe: AudioProbeResult = { duration: 10, sampleRate: 44100, channels: 2 };
      const args = processor.buildConcatenateArgs('/tmp/short.mp3', 30, probe);

      // 计算输入次数：需要多个 -i 参数
      const inputCount = args.filter((a) => a === '-i').length;
      expect(inputCount).toBeGreaterThan(1);
    });

    it('保持原始采样率和声道数（需求 10.9）', () => {
      const probe: AudioProbeResult = { duration: 10, sampleRate: 48000, channels: 1 };
      const args = processor.buildConcatenateArgs('/tmp/short.wav', 30, probe);

      const arIdx = args.indexOf('-ar');
      const acIdx = args.indexOf('-ac');
      expect(args[arIdx + 1]).toBe('48000');
      expect(args[acIdx + 1]).toBe('1');
    });

    it('crossfade 使用三角形曲线', () => {
      const probe: AudioProbeResult = { duration: 10, sampleRate: 44100, channels: 2 };
      const args = processor.buildConcatenateArgs('/tmp/short.mp3', 30, probe);

      const filterIdx = args.indexOf('-filter_complex');
      const filterStr = args[filterIdx + 1];
      expect(filterStr).toContain('c1=tri');
      expect(filterStr).toContain('c2=tri');
    });
  });

  // ─── buildFadeArgs ──────────────────────────────────────

  describe('buildFadeArgs - 淡入淡出命令构建', () => {
    it('包含 500ms 淡入效果（需求 10.6）', () => {
      const probe: AudioProbeResult = { duration: 30, sampleRate: 44100, channels: 2 };
      const args = processor.buildFadeArgs('/tmp/audio.mp3', probe);

      const afIdx = args.indexOf('-af');
      const filterStr = args[afIdx + 1];
      expect(filterStr).toContain('afade=t=in:st=0:d=0.5');
    });

    it('包含 1000ms 淡出效果（需求 10.7）', () => {
      const probe: AudioProbeResult = { duration: 30, sampleRate: 44100, channels: 2 };
      const args = processor.buildFadeArgs('/tmp/audio.mp3', probe);

      const afIdx = args.indexOf('-af');
      const filterStr = args[afIdx + 1];
      // fadeOutStart = 30 - 1.0 = 29
      expect(filterStr).toContain('afade=t=out:st=29:d=1');
    });

    it('淡出起始点根据音频时长动态计算', () => {
      const probe: AudioProbeResult = { duration: 120, sampleRate: 44100, channels: 2 };
      const args = processor.buildFadeArgs('/tmp/long.mp3', probe);

      const afIdx = args.indexOf('-af');
      const filterStr = args[afIdx + 1];
      // fadeOutStart = 120 - 1.0 = 119
      expect(filterStr).toContain('st=119');
    });

    it('输出文件名包含 _faded 后缀', () => {
      const probe: AudioProbeResult = { duration: 30, sampleRate: 44100, channels: 2 };
      const args = processor.buildFadeArgs('/tmp/audio.mp3', probe);

      expect(args[args.length - 1]).toBe('/tmp/audio_faded.mp3');
    });

    it('保持原始采样率和声道数（需求 10.9）', () => {
      const probe: AudioProbeResult = { duration: 30, sampleRate: 96000, channels: 6 };
      const args = processor.buildFadeArgs('/tmp/hires.wav', probe);

      const arIdx = args.indexOf('-ar');
      const acIdx = args.indexOf('-ac');
      expect(args[arIdx + 1]).toBe('96000');
      expect(args[acIdx + 1]).toBe('6');
    });
  });
});


// ─── AudioPipeline Tests ──────────────────────────────────

describe('AudioPipeline', () => {
  let pipeline: AudioPipeline;
  let mockProcessor: AudioProcessor;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProcessor = new AudioProcessor();

    // Mock all processor methods
    vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
      duration: 45,
      sampleRate: 44100,
      channels: 2,
    });
    vi.spyOn(mockProcessor, 'trimAudio').mockResolvedValue('/tmp/audio_trimmed.mp3');
    vi.spyOn(mockProcessor, 'concatenateAudio').mockResolvedValue('/tmp/audio_concat.mp3');
    vi.spyOn(mockProcessor, 'applyFadeEffects').mockResolvedValue('/tmp/audio_faded.mp3');

    pipeline = new AudioPipeline(mockProcessor);
  });

  // ─── processGeneratedAudio 流水线编排 ───────────────────

  describe('processGeneratedAudio - 流水线编排', () => {
    it('原始音频 >= 目标时长时执行裁剪 + 淡入淡出（需求 10.3, 10.8）', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 45,
        sampleRate: 44100,
        channels: 2,
      });

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      expect(mockProcessor.trimAudio).toHaveBeenCalledWith('/tmp/audio.mp3', 30);
      expect(mockProcessor.concatenateAudio).not.toHaveBeenCalled();
      expect(mockProcessor.applyFadeEffects).toHaveBeenCalledWith('/tmp/audio_trimmed.mp3');
      expect((result as AudioProcessingResult).success).toBe(true);
    });

    it('原始音频 < 目标时长时执行拼接 + 淡入淡出（需求 10.4, 10.8）', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 20,
        sampleRate: 44100,
        channels: 2,
      });

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      expect(mockProcessor.concatenateAudio).toHaveBeenCalledWith('/tmp/audio.mp3', 30);
      expect(mockProcessor.trimAudio).not.toHaveBeenCalled();
      expect(mockProcessor.applyFadeEffects).toHaveBeenCalledWith('/tmp/audio_concat.mp3');
      expect((result as AudioProcessingResult).success).toBe(true);
    });

    it('原始音频恰好等于目标时长时执行裁剪', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 30,
        sampleRate: 44100,
        channels: 2,
      });

      await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      expect(mockProcessor.trimAudio).toHaveBeenCalled();
      expect(mockProcessor.concatenateAudio).not.toHaveBeenCalled();
    });

    it('返回结果包含正确的采样率和声道数（需求 10.9）', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 60,
        sampleRate: 48000,
        channels: 1,
      });

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30) as AudioProcessingResult;

      expect(result.sampleRate).toBe(48000);
      expect(result.channels).toBe(1);
      expect(result.duration).toBe(30);
    });

    it('支持 120 秒目标时长', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 180,
        sampleRate: 44100,
        channels: 2,
      });

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 120) as AudioProcessingResult;

      expect(mockProcessor.trimAudio).toHaveBeenCalledWith('/tmp/audio.mp3', 120);
      expect(result.duration).toBe(120);
    });
  });

  // ─── 错误处理 ───────────────────────────────────────────

  describe('错误处理 - 保留原始文件（需求 10.10）', () => {
    it('FFmpeg 失败时返回错误信息并保留原始文件路径', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockRejectedValue(new Error('ffprobe not found'));

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      const error = result as AudioProcessingError;
      expect(error.code).toBe('PROCESSING_FAILED');
      expect(error.message).toBe('音频处理失败，请重试');
      expect(error.originalFilePath).toBe('/tmp/audio.mp3');
    });

    it('裁剪失败时返回错误并保留原始文件', async () => {
      vi.spyOn(mockProcessor, 'trimAudio').mockRejectedValue(new Error('FFmpeg trim failed'));

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      const error = result as AudioProcessingError;
      expect(error.code).toBe('PROCESSING_FAILED');
      expect(error.message).toBe('音频处理失败，请重试');
      expect(error.originalFilePath).toBe('/tmp/audio.mp3');
    });

    it('拼接失败时返回错误并保留原始文件', async () => {
      vi.spyOn(mockProcessor, 'probeAudio').mockResolvedValue({
        duration: 10,
        sampleRate: 44100,
        channels: 2,
      });
      vi.spyOn(mockProcessor, 'concatenateAudio').mockRejectedValue(new Error('FFmpeg concat failed'));

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      const error = result as AudioProcessingError;
      expect(error.code).toBe('PROCESSING_FAILED');
      expect(error.originalFilePath).toBe('/tmp/audio.mp3');
    });

    it('淡入淡出失败时返回错误并保留原始文件', async () => {
      vi.spyOn(mockProcessor, 'applyFadeEffects').mockRejectedValue(new Error('FFmpeg fade failed'));

      const result = await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      const error = result as AudioProcessingError;
      expect(error.code).toBe('PROCESSING_FAILED');
      expect(error.originalFilePath).toBe('/tmp/audio.mp3');
    });

    it('错误日志被记录', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(mockProcessor, 'probeAudio').mockRejectedValue(new Error('test error'));

      await pipeline.processGeneratedAudio('/tmp/audio.mp3', 30);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('音频处理失败'),
        expect.objectContaining({ inputPath: '/tmp/audio.mp3', targetDuration: 30 })
      );
      consoleSpy.mockRestore();
    });
  });
});
