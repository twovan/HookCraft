import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getKieUserFacingErrorMessage,
  isKieProviderCreditsInsufficient,
  KieSunoProvider,
} from './KieSunoProvider';

describe('KieSunoProvider vocal removal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends separate_vocal when creating a basic two-track stem job', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 200,
      data: { taskId: 'kie-basic-task' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new KieSunoProvider({ apiKey: 'test-key' });
    await provider.splitStems({
      sourceTaskId: 'source-task',
      sourceAudioId: 'audio-id',
      type: 'separate_vocal',
      callBackUrl: 'https://example.com/callback',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kie.ai/api/v1/vocal-removal/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          taskId: 'source-task',
          audioId: 'audio-id',
          type: 'separate_vocal',
          callBackUrl: 'https://example.com/callback',
        }),
      }),
    );
  });

  it('keeps split_stem as the default professional stem mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 200,
      data: { taskId: 'kie-pro-task' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new KieSunoProvider({ apiKey: 'test-key' });
    await provider.splitStems({
      sourceTaskId: 'source-task',
      sourceAudioId: 'audio-id',
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      type: 'split_stem',
    });
  });
});

describe('KieSunoProvider error normalization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports non-JSON provider responses without exposing raw JSON parse errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>gateway error</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new KieSunoProvider({ apiKey: 'test-key' });

    await expect(provider.addInstrumental({
      uploadUrl: 'https://example.com/input.mp3',
      title: 'demo',
      tags: 'pop',
      model: 'V5_5',
    })).rejects.toThrow('Kie API returned non-JSON response (502, text/html)');
  });

  it('detects provider account credit exhaustion messages', () => {
    expect(isKieProviderCreditsInsufficient(
      'Credits insufficient : Your current balance isn’t enough to run this request. Please top up to continue.',
    )).toBe(true);
  });

  it('maps provider credit exhaustion to a service-side message', () => {
    expect(getKieUserFacingErrorMessage(
      'Credits insufficient : Your current balance isn’t enough to run this request.',
    )).toBe('生成服务额度不足，当前不是你的 HookCraft 余额问题，请联系管理员处理后重试');
  });

  it('maps non-JSON provider responses to a service-side message', () => {
    expect(getKieUserFacingErrorMessage(
      'Kie API returned non-JSON response (502, text/html): <html>gateway error</html>',
    )).toBe('生成服务响应异常，请稍后重试');
  });

  it('does not invent an error message when Kie has no error', () => {
    expect(getKieUserFacingErrorMessage(null)).toBeNull();
  });
});
