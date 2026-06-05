import { describe, expect, it, vi } from 'vitest';
import { TemplateAdminService } from './TemplateAdminService';

function createService(row: any) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const supabase = {
    from: vi.fn().mockReturnValue({ select }),
  } as any;

  return {
    service: new TemplateAdminService(supabase, vi.fn()),
    select,
  };
}

describe('TemplateAdminService advanced style cache', () => {
  it('returns the saved advanced style prompt with cached template analysis', async () => {
    const { service, select } = createService({
      id: 'tpl-advanced',
      analysis_result: 'regular analysis',
      lyria_prompt: 'Regular prompt',
      analyzed_at: '2026-06-05T10:00:00Z',
      analysis_status: 'completed',
      suno_prompt: 'Advanced style prompt',
      suno_analysis_status: 'completed',
    });

    const cached = await service.getCachedAnalysis('tpl-advanced');

    expect(select).toHaveBeenCalledWith(
      'id, analysis_result, lyria_prompt, analyzed_at, analysis_status, suno_prompt, suno_analysis_status',
    );
    expect(cached?.lyriaPrompt).toBe('Regular prompt');
    expect(cached?.advancedPrompt).toBe('Advanced style prompt');
    expect(cached?.advancedStatus).toBe('completed');
  });
});
