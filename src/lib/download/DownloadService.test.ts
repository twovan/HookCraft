import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadService } from './DownloadService';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createSupabaseMock(audioPath: string) {
  const taskSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'task-1',
      user_id: 'user-1',
      status: 'selected',
      audio_path: audioPath,
      batch_id: 'batch-1',
      version_number: 2,
    },
    error: null,
  });
  const taskEqUser = vi.fn().mockReturnValue({ single: taskSingle });
  const taskEqId = vi.fn().mockReturnValue({ eq: taskEqUser });
  const taskSelect = vi.fn().mockReturnValue({ eq: taskEqId });

  const countMaybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  const countLte = vi.fn().mockReturnValue({ maybeSingle: countMaybeSingle });
  const countGte = vi.fn().mockReturnValue({ lte: countLte });
  const countEq = vi.fn().mockReturnValue({ gte: countGte });
  const countSelect = vi.fn().mockReturnValue({ eq: countEq });
  const countInsert = vi.fn().mockResolvedValue({ error: null });

  const storageDownload = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'not found' },
  });
  const storageFrom = vi.fn().mockReturnValue({ download: storageDownload });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'generation_tasks') {
      return { select: taskSelect };
    }
    if (table === 'download_counts') {
      return { select: countSelect, insert: countInsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: {
      from,
      storage: { from: storageFrom },
    },
    storageDownload,
  };
}

describe('DownloadService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('downloads an http audio_path without treating it as a storage path', async () => {
    const audioPath = 'https://cdn.example.com/generated.mp3';
    const { supabase, storageDownload } = createSupabaseMock(audioPath);
    const audioBytes = new Uint8Array([1, 2, 3]);

    mockFetch.mockResolvedValueOnce(new Response(audioBytes, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    }));

    const service = new DownloadService(supabase as any);
    const result = await service.download('user-1', 'pro', 'task-1');

    expect(result.success).toBe(true);
    expect(result.audioBuffer).toEqual(Buffer.from(audioBytes));
    expect(result.filename).toBe('creation-batch-1-v2.mp3');
    expect(mockFetch).toHaveBeenCalledWith(audioPath);
    expect(storageDownload).not.toHaveBeenCalled();
  });
});
