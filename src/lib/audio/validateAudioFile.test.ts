// validateAudioFile 单元测试
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAudioFile, getAudioDuration } from './validateAudioFile';

// ─── Mock Web Audio API ──────────────────────────────────

const mockDecodeAudioData = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);

class MockAudioContext {
  decodeAudioData = mockDecodeAudioData;
  close = mockClose;
}

vi.stubGlobal('AudioContext', MockAudioContext);

/** 创建模拟 File 对象 */
function createMockFile(options: {
  type?: string;
  size?: number;
  name?: string;
}): File {
  const { type = 'audio/mpeg', size = 1024, name = 'test.mp3' } = options;
  // 创建指定大小的 ArrayBuffer
  const buffer = new ArrayBuffer(size);
  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type });
}

describe('validateAudioFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认返回 60 秒时长的 AudioBuffer
    mockDecodeAudioData.mockResolvedValue({ duration: 60 });
  });

  // ─── 格式校验（Step 1）──────────────────────────────────

  describe('格式校验', () => {
    it('MP3 格式通过校验', async () => {
      const file = createMockFile({ type: 'audio/mpeg' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
    });

    it('WAV 格式（audio/wav）通过校验', async () => {
      const file = createMockFile({ type: 'audio/wav' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
    });

    it('WAV 格式（audio/x-wav）通过校验', async () => {
      const file = createMockFile({ type: 'audio/x-wav' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
    });

    it('不支持的格式返回错误', async () => {
      const file = createMockFile({ type: 'audio/flac' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('仅支持 MP3/WAV 格式');
    });

    it('OGG 格式被拒绝', async () => {
      const file = createMockFile({ type: 'audio/ogg' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('仅支持 MP3/WAV 格式');
    });

    it('非音频文件被拒绝', async () => {
      const file = createMockFile({ type: 'application/pdf' });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('仅支持 MP3/WAV 格式');
    });

    it('格式错误时不进行后续校验（不调用 decodeAudioData）', async () => {
      const file = createMockFile({ type: 'audio/flac' });
      await validateAudioFile(file);
      expect(mockDecodeAudioData).not.toHaveBeenCalled();
    });
  });

  // ─── 大小校验（Step 2）──────────────────────────────────

  describe('大小校验', () => {
    it('50MB 以内通过校验', async () => {
      const file = createMockFile({ size: 50 * 1024 * 1024 });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
    });

    it('恰好 50MB 通过校验', async () => {
      const file = createMockFile({ size: 50 * 1024 * 1024 });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
    });

    it('超过 50MB 返回错误', async () => {
      const file = createMockFile({ size: 50 * 1024 * 1024 + 1 });
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('文件大小不能超过 50MB');
    });

    it('大小超限时不进行时长校验（不调用 decodeAudioData）', async () => {
      const file = createMockFile({ size: 100 * 1024 * 1024 });
      await validateAudioFile(file);
      expect(mockDecodeAudioData).not.toHaveBeenCalled();
    });
  });

  // ─── 时长校验（Step 3）──────────────────────────────────

  describe('时长校验', () => {
    it('6 秒时长通过校验（下界）', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 6 });
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
      expect(result.duration).toBe(6);
    });

    it('360 秒时长通过校验（上界）', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 360 });
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
      expect(result.duration).toBe(360);
    });

    it('时长不足 6 秒返回错误', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 5.99 });
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('音频时长不能少于 6 秒');
    });

    it('时长超过 360 秒返回错误', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 360.01 });
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('音频时长不能超过 6 分钟');
    });

    it('解码失败返回对应错误信息', async () => {
      mockDecodeAudioData.mockRejectedValue(new Error('Unable to decode'));
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('音频文件无法解码，可能已损坏或格式不支持');
    });
  });

  // ─── 校验顺序 ──────────────────────────────────────────

  describe('校验顺序', () => {
    it('格式错误优先于大小错误', async () => {
      const file = createMockFile({ type: 'audio/flac', size: 100 * 1024 * 1024 });
      const result = await validateAudioFile(file);
      expect(result.error).toBe('仅支持 MP3/WAV 格式');
    });

    it('大小错误优先于时长错误', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 1 });
      const file = createMockFile({ size: 100 * 1024 * 1024 });
      const result = await validateAudioFile(file);
      expect(result.error).toBe('文件大小不能超过 50MB');
    });
  });

  // ─── 成功结果 ──────────────────────────────────────────

  describe('成功结果', () => {
    it('通过所有校验时返回 valid: true 和 duration', async () => {
      mockDecodeAudioData.mockResolvedValue({ duration: 90.567 });
      const file = createMockFile({});
      const result = await validateAudioFile(file);
      expect(result.valid).toBe(true);
      expect(result.duration).toBe(90.57); // 精度到小数点后 2 位
    });
  });
});

describe('getAudioDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回音频时长（秒）', async () => {
    mockDecodeAudioData.mockResolvedValue({ duration: 120.456 });
    const file = createMockFile({});
    const duration = await getAudioDuration(file);
    expect(duration).toBe(120.46); // 精度到小数点后 2 位
  });

  it('解码失败时抛出错误', async () => {
    mockDecodeAudioData.mockRejectedValue(new Error('Decode failed'));
    const file = createMockFile({});
    await expect(getAudioDuration(file)).rejects.toThrow('Decode failed');
  });

  it('调用后关闭 AudioContext', async () => {
    mockDecodeAudioData.mockResolvedValue({ duration: 30 });
    const file = createMockFile({});
    await getAudioDuration(file);
    expect(mockClose).toHaveBeenCalled();
  });

  it('解码失败时也关闭 AudioContext', async () => {
    mockDecodeAudioData.mockRejectedValue(new Error('Decode failed'));
    const file = createMockFile({});
    try {
      await getAudioDuration(file);
    } catch {
      // expected
    }
    expect(mockClose).toHaveBeenCalled();
  });
});
