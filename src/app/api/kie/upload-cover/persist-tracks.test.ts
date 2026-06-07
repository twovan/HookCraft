import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistCompletedCoverTracks } from './persist-tracks';
import { supabaseAdmin } from '../../../../lib/supabase/server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../../../lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

describe('persistCompletedCoverTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
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

  it('stores completed Kie track audio in Supabase before saving rows', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const batchUpdateQuery: any = {
      eq: vi.fn(() => batchUpdateQuery),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    const update = vi.fn(() => batchUpdateQuery);
    const taskQuery: any = {
      eq: vi.fn(() => taskQuery),
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
          credits_consumed: 12,
          status: 'generating',
          error_code: null,
        },
        error: null,
      })),
    };
    const tableByName: Record<string, any> = {
      generation_tasks: {
        select: vi.fn(() => taskQuery),
        upsert,
      },
      generation_batches: {
        update,
      },
    };
    const upload = vi.fn(async () => ({
      data: { path: 'user-1/kie/task-1/v1.mp3' },
      error: null,
    }));

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => tableByName[table]);
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({ upload } as any);
    mockFetch.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }));

    const result = await persistCompletedCoverTracks({
      localTaskId: 'task-1',
      tracks: [{ id: 'audio-1', audioUrl: 'https://tempfile.aiquickdraw.com/audio.mp3' } as any],
    });

    expect(result).toEqual({ batchId: 'batch-1', savedCount: 1 });
    expect(mockFetch).toHaveBeenCalledWith('https://tempfile.aiquickdraw.com/audio.mp3');
    expect(upload).toHaveBeenCalledWith(
      'user-1/kie/task-1/v1.mp3',
      expect.any(Buffer),
      { upsert: true, contentType: 'audio/mpeg' },
    );
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ audio_path: 'user-1/kie/task-1/v1.mp3' })],
      { onConflict: 'id' },
    );
  });
});
