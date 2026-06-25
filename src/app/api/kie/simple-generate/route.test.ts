import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/lib/supabase/auth-helpers', () => ({
  getAuthUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {},
}));

vi.mock('@/lib/generation/KieSunoProvider', () => ({
  KieSunoProvider: vi.fn(() => ({
    generateMusic: vi.fn(),
  })),
  getKieUserFacingErrorMessage: (message?: string | null) => message || null,
  isKieProviderCreditsInsufficient: () => false,
}));

vi.mock('@/lib/credits/CreditService', () => ({
  CreditService: vi.fn(() => ({
    hasEnoughCredits: vi.fn().mockResolvedValue(true),
    consumeCredits: vi.fn().mockResolvedValue({ success: true, consumed: 20, remaining: 80 }),
  })),
}));

describe('/api/kie/simple-generate', () => {
  it('rejects an empty prompt before creating a KIE task', async () => {
    const req = new NextRequest('http://localhost/api/kie/simple-generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('请输入生成描述');
  });
});
