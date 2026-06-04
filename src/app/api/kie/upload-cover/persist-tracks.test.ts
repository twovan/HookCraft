import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistCompletedCoverTracks } from './persist-tracks';
import { supabaseAdmin } from '../../../../lib/supabase/server';

vi.mock('../../../../lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('persistCompletedCoverTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not complete a task that failed because credits were not deducted', async () => {
    const upsert = vi.fn();
    const query: any = {
      eq: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'task-1',
          user_id: 'user-1',
          batch_id: 'batch-1',
          prompt: 'prompt',
          title: 'title',
          raw_audio_path: 'kie:provider-task-1',
          model_id: 'kie-suno-v5_5',
          generation_type: 'full_demo',
          template_id: null,
          credits_consumed: 0,
          status: 'failed',
          error_code: 'CREDITS_NOT_ENOUGH',
        },
        error: null,
      })),
    };
    const table = {
      select: vi.fn(() => query),
      upsert,
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(table as any);

    const result = await persistCompletedCoverTracks({
      localTaskId: 'task-1',
      tracks: [{ id: 'audio-1', audioUrl: 'https://example.com/audio.mp3' } as any],
    });

    expect(result).toEqual({ batchId: 'batch-1', savedCount: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });
});
