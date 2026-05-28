import { describe, expect, it, vi } from 'vitest';
import { StyleDnaRepository } from './StyleDnaRepository';

describe('StyleDnaRepository', () => {
  it('creates a job in style_dna_jobs', async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => ({ data: { id: 'job-1' }, error: null }) }) });
    const from = vi.fn().mockReturnValue({ insert });
    const repo = new StyleDnaRepository({ from } as any);

    await repo.createJob({ id: 'job-1', userId: 'user-1', name: 'My DNA', now: '2026-05-27T00:00:00.000Z' });

    expect(from).toHaveBeenCalledWith('style_dna_jobs');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'job-1',
      user_id: 'user-1',
      name: 'My DNA',
      status: 'pending',
    }));
  });

  it('creates a reusable style dna template snapshot', async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => ({ data: { id: 'template-1' }, error: null }) }) });
    const from = vi.fn().mockReturnValue({ insert });
    const repo = new StyleDnaRepository({ from } as any);

    await repo.createTemplate({
      id: 'template-1',
      user_id: 'user-1',
      style_dna_id: 'dna-1',
      name: 'Warm Ballad DNA',
      description: 'Piano-led emotional pop profile',
      style_dna_snapshot: { id: 'dna-1' },
      prompt_package_snapshot: { id: 'pkg-1' },
      tags: ['mandarin pop', '78-88 BPM'],
      created_at: '2026-05-27T00:00:00.000Z',
      updated_at: '2026-05-27T00:00:00.000Z',
    });

    expect(from).toHaveBeenCalledWith('style_dna_templates');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'template-1',
      user_id: 'user-1',
      style_dna_id: 'dna-1',
      name: 'Warm Ballad DNA',
    }));
  });
});
