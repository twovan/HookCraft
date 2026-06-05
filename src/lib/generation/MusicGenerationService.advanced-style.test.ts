import { describe, expect, it, vi } from 'vitest';
import { MusicGenerationService } from './MusicGenerationService';
import type { AIModelProvider } from './AIModelProvider';

const provider: AIModelProvider = {
  providerName: 'mock-provider',
  generatePreview: vi.fn(),
  generateFullDemo: vi.fn(),
};

function createService(cachedAnalysis: any) {
  return new MusicGenerationService({
    supabase: { from: vi.fn() } as any,
    provider,
    creditService: {} as any,
    templateService: {} as any,
    templateAdminService: {
      getCachedAnalysis: vi.fn().mockResolvedValue(cachedAnalysis),
    } as any,
  });
}

describe('MusicGenerationService advanced template style', () => {
  it('uses the advanced style prompt before the regular template prompt', async () => {
    const service = createService({
      templateId: 'tpl-advanced',
      analysisResult: 'analysis',
      lyriaPrompt: 'Basic Lyria style prompt',
      advancedPrompt: 'Advanced Suno style prompt',
      advancedStatus: 'completed',
      analyzedAt: new Date(),
      status: 'completed',
    });

    const prompt = await service.buildPrompt({
      templateId: 'tpl-advanced',
      generationType: 'preview',
    });

    expect(prompt).toContain('Advanced Suno style prompt');
    expect(prompt).not.toContain('Basic Lyria style prompt');
  });
});
