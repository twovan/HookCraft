import { afterEach, describe, expect, it, vi } from 'vitest';
import { KieSunoProvider } from './KieSunoProvider';

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
