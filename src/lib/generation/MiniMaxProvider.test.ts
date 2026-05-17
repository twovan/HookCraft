// MiniMaxProvider 单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MiniMaxProvider } from './MiniMaxProvider';
import type {
  PreprocessInput,
  ArrangementGenerationInput,
} from '../../types/arrangement';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 设置环境变量
beforeEach(() => {
  vi.stubEnv('MINIMAX_API_KEY', 'test-minimax-key');
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Constructor ────────────────────────────────────────

describe('MiniMaxProvider constructor', () => {
  it('使用配置中的 apiKey 初始化', () => {
    const provider = new MiniMaxProvider({ apiKey: 'custom-key' });
    expect(provider.providerName).toBe('minimax');
  });

  it('未提供 apiKey 时从环境变量读取', () => {
    const provider = new MiniMaxProvider();
    expect(provider.providerName).toBe('minimax');
  });

  it('apiKey 为空时抛出错误', () => {
    vi.stubEnv('MINIMAX_API_KEY', '');
    expect(() => new MiniMaxProvider({ apiKey: '' })).toThrow('MiniMax API Key 未配置');
  });
});

// ─── preprocess ────────────────────────────────────────

describe('MiniMaxProvider.preprocess', () => {
  it('成功预处理音频并返回结果', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        cover_feature_id: 'feat_123',
        formatted_lyrics: '[verse]\n月光洒在窗台',
        structure_result: 'verse-chorus-verse',
        audio_duration: 120,
      }),
    });

    const input: PreprocessInput = { audioBase64: 'base64data' };
    const result = await provider.preprocess(input);

    expect(result.coverFeatureId).toBe('feat_123');
    expect(result.formattedLyrics).toBe('[verse]\n月光洒在窗台');
    expect(result.structureResult).toBe('verse-chorus-verse');
    expect(result.audioDuration).toBe(120);

    // 验证请求参数
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/music_cover_preprocess',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
        }),
      })
    );
  });

  it('支持 audioUrl 输入', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        cover_feature_id: 'feat_456',
        formatted_lyrics: '',
        structure_result: '',
        audio_duration: 60,
      }),
    });

    const input: PreprocessInput = { audioBase64: '', audioUrl: 'https://example.com/audio.mp3' };
    const result = await provider.preprocess(input);

    expect(result.coverFeatureId).toBe('feat_456');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.audio_url).toBe('https://example.com/audio.mp3');
  });

  it('HTTP 错误时抛出异常', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'server error',
    });

    const input: PreprocessInput = { audioBase64: 'data' };
    await expect(provider.preprocess(input)).rejects.toThrow('MiniMax 预处理请求失败 (500)');
  });

  it('业务错误时抛出异常', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 1001, status_msg: '音频格式不支持' },
      }),
    });

    const input: PreprocessInput = { audioBase64: 'data' };
    await expect(provider.preprocess(input)).rejects.toThrow('MiniMax 预处理失败: 音频格式不支持');
  });

  it('缺少 cover_feature_id 时抛出异常', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        // 缺少 cover_feature_id
      }),
    });

    const input: PreprocessInput = { audioBase64: 'data' };
    await expect(provider.preprocess(input)).rejects.toThrow('未获取到音频特征 ID');
  });

  it('请求超时时抛出超时错误', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const input: PreprocessInput = { audioBase64: 'data' };

    // 使用 fake timers 模拟超时
    vi.useFakeTimers();
    const promise = provider.preprocess(input);
    vi.advanceTimersByTime(60_000);

    await expect(promise).rejects.toThrow('MiniMax API 请求超时 (60s)');
    vi.useRealTimers();
  });
});

// ─── generateArrangement ────────────────────────────────

describe('MiniMaxProvider.generateArrangement', () => {
  it('成功生成编曲并返回结果', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        audio_file: 'https://cdn.minimax.io/audio/result.mp3',
        task_id: 'task_789',
      }),
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\n月光洒在窗台',
      prompt: 'A dreamy pop arrangement',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await provider.generateArrangement(input);

    expect(result.success).toBe(true);
    expect(result.audioUrl).toBe('https://cdn.minimax.io/audio/result.mp3');
    expect(result.taskId).toBe('task_789');

    // 验证请求参数
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('music-cover');
    expect(callBody.cover_feature_id).toBe('feat_123');
    expect(callBody.lyrics).toBe('[verse]\n月光洒在窗台');
    expect(callBody.is_instrumental).toBe(false);
    expect(callBody.prompt).toBe('A dreamy pop arrangement');
    expect(callBody.audio_setting).toEqual({
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    });
  });

  it('纯器乐模式时 lyrics 为空字符串', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        audio_file: 'https://cdn.minimax.io/audio/instrumental.mp3',
      }),
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\n这些歌词不会被发送',
      isInstrumental: true,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 128000,
        format: 'mp3',
      },
    };

    await provider.generateArrangement(input);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.lyrics).toBe('');
    expect(callBody.is_instrumental).toBe(true);
  });

  it('不提供 prompt 时请求体中不包含 prompt 字段', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        audio_file: 'https://cdn.minimax.io/audio/result.mp3',
      }),
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nHello',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    await provider.generateArrangement(input);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.prompt).toBeUndefined();
  });

  it('HTTP 错误时返回失败结果', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nTest',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await provider.generateArrangement(input);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HTTP_429');
    expect(result.error?.message).toContain('429');
  });

  it('业务错误时返回失败结果', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 2001, status_msg: '内容安全检查未通过' },
      }),
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nTest',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await provider.generateArrangement(input);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('2001');
    expect(result.error?.message).toBe('内容安全检查未通过');
  });

  it('请求超时时抛出超时错误', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nTest',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    vi.useFakeTimers();
    const promise = provider.generateArrangement(input);
    vi.advanceTimersByTime(300_000);

    await expect(promise).rejects.toThrow('MiniMax API 请求超时 (300s)');
    vi.useRealTimers();
  });

  it('网络错误时抛出网络错误', async () => {
    const provider = new MiniMaxProvider({ apiKey: 'test-key' });

    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nTest',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    await expect(provider.generateArrangement(input)).rejects.toThrow('MiniMax API 网络错误: Network failure');
  });

  it('使用自定义 baseUrl', async () => {
    const provider = new MiniMaxProvider({
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.minimax.io',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        base_resp: { status_code: 0, status_msg: 'success' },
        audio_file: 'https://cdn.minimax.io/audio/result.mp3',
      }),
    });

    const input: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: 'feat_123',
      lyrics: '[verse]\nTest',
      isInstrumental: false,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    await provider.generateArrangement(input);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.api.minimax.io/v1/music_generation',
      expect.anything()
    );
  });
});
