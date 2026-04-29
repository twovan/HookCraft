// LyriaProvider 单元测试
import { describe, it, expect } from 'vitest';
import { LyriaProvider } from './LyriaProvider';
import type {
  GenerationRequest,
  GeminiRawResponse,
  LyriaModelId,
} from '../../types/generation';

// 创建一个 LyriaProvider 实例用于测试 parseResponse 和 buildGenerationConfig
// 使用 dummy API key，不会实际调用 API
const provider = new LyriaProvider('test-api-key');

// ─── parseResponse ────────────────────────────────────────

describe('LyriaProvider.parseResponse', () => {
  it('正确分离 text parts（歌词）和 inline_data parts（音频）', () => {
    const response: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [
            { text: 'Verse 1: Hello world' },
            { inlineData: { mimeType: 'audio/mpeg', data: Buffer.from('fake-audio').toString('base64') } },
          ],
        },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-clip-preview');

    expect(result.success).toBe(true);
    expect(result.lyrics).toBe('Verse 1: Hello world');
    expect(result.audioData).toBeInstanceOf(Buffer);
    expect(result.audioMimeType).toBe('audio/mpeg');
    expect(result.modelId).toBe('lyria-3-clip-preview');
  });

  it('多个 text parts 合并为歌词', () => {
    const response: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [
            { text: 'Verse 1: Line one' },
            { text: 'Chorus: Sing along' },
            { inlineData: { mimeType: 'audio/mpeg', data: Buffer.from('audio').toString('base64') } },
          ],
        },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-pro-preview');

    expect(result.lyrics).toBe('Verse 1: Line one\nChorus: Sing along');
  });

  it('JSON 格式的 text part 识别为歌曲结构描述', () => {
    const structureJson = '{"sections": [{"type": "Verse"}, {"type": "Chorus"}]}';
    const response: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [
            { text: structureJson },
            { text: 'Some lyrics here' },
            { inlineData: { mimeType: 'audio/mpeg', data: Buffer.from('audio').toString('base64') } },
          ],
        },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-pro-preview');

    expect(result.songStructureDescription).toBe(structureJson);
    expect(result.lyrics).toBe('Some lyrics here');
  });

  it('无 parts 时返回 success: false', () => {
    const response: GeminiRawResponse = {
      candidates: [{
        content: { parts: [] },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-clip-preview');

    expect(result.success).toBe(false);
    expect(result.audioData).toBeUndefined();
  });

  it('仅有 text parts 无音频时返回 success: false', () => {
    const response: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [{ text: 'Only lyrics, no audio' }],
        },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-clip-preview');

    expect(result.success).toBe(false);
    expect(result.lyrics).toBe('Only lyrics, no audio');
    expect(result.audioData).toBeUndefined();
  });

  it('hasSynthIdWatermark 始终为 true', () => {
    const successResponse: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [
            { inlineData: { mimeType: 'audio/mpeg', data: Buffer.from('audio').toString('base64') } },
          ],
        },
      }],
    };

    const failResponse: GeminiRawResponse = {
      candidates: [{ content: { parts: [] } }],
    };

    expect(provider.parseResponse(successResponse, 'lyria-3-clip-preview').hasSynthIdWatermark).toBe(true);
    expect(provider.parseResponse(failResponse, 'lyria-3-pro-preview').hasSynthIdWatermark).toBe(true);
  });

  it('WAV 格式音频正确解析', () => {
    const response: GeminiRawResponse = {
      candidates: [{
        content: {
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: Buffer.from('wav-data').toString('base64') } },
          ],
        },
      }],
    };

    const result = provider.parseResponse(response, 'lyria-3-pro-preview');

    expect(result.success).toBe(true);
    expect(result.audioMimeType).toBe('audio/wav');
  });
});

// ─── buildGenerationConfig ────────────────────────────────

describe('LyriaProvider.buildGenerationConfig', () => {
  it('默认设置 responseModalities 为 ["AUDIO", "TEXT"]', () => {
    const request: GenerationRequest = {
      prompt: 'A pop song',
      outputFormat: 'audio/mpeg',
    };

    const config = provider.buildGenerationConfig(request);

    expect(config.responseModalities).toEqual(['AUDIO', 'TEXT']);
  });

  it('MP3 格式不设置 responseMimeType', () => {
    const request: GenerationRequest = {
      prompt: 'A rock song',
      outputFormat: 'audio/mpeg',
    };

    const config = provider.buildGenerationConfig(request);

    expect(config.responseMimeType).toBeUndefined();
  });

  it('WAV 格式设置 responseMimeType 为 "audio/wav"', () => {
    const request: GenerationRequest = {
      prompt: 'A jazz song',
      outputFormat: 'audio/wav',
    };

    const config = provider.buildGenerationConfig(request);

    expect(config.responseMimeType).toBe('audio/wav');
  });
});
