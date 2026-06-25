# Studio Simple Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-toggleable Studio "简单模式" tab that generates KIE Suno music from a single text prompt without selecting a template.

**Architecture:** Reuse the existing Studio tab settings as the feature switch. Add a focused KIE text-generation provider method, a thin `/api/kie/simple-generate` route that follows the current KIE batch/task/credits pattern, and a small `SimpleGenerationTab` UI component rendered by `StudioPageClient`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase admin client, Vitest.

---

## File Structure

- Modify `src/config/studioTabs.ts`: add `simple` to `STUDIO_TAB_OPTIONS`; normalization already works from the option list.
- Create `src/config/studioTabs.test.ts`: verify the new tab can be visible and default.
- Modify `src/types/kie.ts`: add request/result types for KIE generate-music.
- Modify `src/lib/generation/KieSunoProvider.ts`: add `generateMusic` using `/api/v1/generate`.
- Modify `src/lib/generation/KieSunoProvider.test.ts`: verify `customMode: false` request payload.
- Create `src/app/api/kie/simple-generate/route.ts`: authenticated JSON API for prompt-only KIE generation.
- Create `src/app/api/kie/simple-generate/route.test.ts`: verify empty prompt is rejected before KIE is called.
- Create `src/components/studio/SimpleGenerationTab.tsx`: minimal user-facing prompt form.
- Modify `src/app/studio/StudioPageClient.tsx`: import/render the new tab.

## Task 1: Add Studio Tab Option

**Files:**
- Modify: `src/config/studioTabs.ts`
- Create: `src/config/studioTabs.test.ts`

- [ ] **Step 1: Write the failing config test**

Create `src/config/studioTabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeStudioTabSettings, STUDIO_TAB_OPTIONS } from './studioTabs';

describe('studio tab settings', () => {
  it('includes simple mode as an admin-toggleable Studio tab', () => {
    expect(STUDIO_TAB_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'simple', label: '简单模式' }),
      ]),
    );
  });

  it('allows simple mode as the default tab when visible', () => {
    expect(normalizeStudioTabSettings({
      visibleTabs: ['simple'],
      defaultTab: 'simple',
    })).toEqual({
      visibleTabs: ['simple'],
      defaultTab: 'simple',
    });
  });
});
```

- [ ] **Step 2: Run the config test to verify it fails**

Run: `npx vitest run src/config/studioTabs.test.ts`

Expected: FAIL because `simple` is not in `STUDIO_TAB_OPTIONS`.

- [ ] **Step 3: Add the tab**

In `src/config/studioTabs.ts`, add the option:

```ts
export const STUDIO_TAB_OPTIONS = [
  { id: 'simple', label: '简单模式' },
  { id: 'template', label: '模板生成' },
  { id: 'upload', label: '翻唱模式' },
  { id: 'advanced', label: '参考编曲模式' },
  { id: 'templateArrangement', label: '模板编曲' },
  { id: 'templateInstrumental', label: '模板伴奏' },
] as const;
```

Keep `DEFAULT_STUDIO_TAB_SETTINGS.defaultTab` unchanged unless product asks for simple mode as the default.

- [ ] **Step 4: Run the config test**

Run: `npx vitest run src/config/studioTabs.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- src/config/studioTabs.ts src/config/studioTabs.test.ts
git commit -m "feat: add studio simple tab option"
```

## Task 2: Add KIE Generate-Music Provider Method

**Files:**
- Modify: `src/types/kie.ts`
- Modify: `src/lib/generation/KieSunoProvider.ts`
- Modify: `src/lib/generation/KieSunoProvider.test.ts`

- [ ] **Step 1: Write the failing provider test**

Append this test to `src/lib/generation/KieSunoProvider.test.ts`:

```ts
describe('KieSunoProvider generate music', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a prompt-only generate-music request in non-custom mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 200,
      data: { taskId: 'kie-simple-task' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new KieSunoProvider({ apiKey: 'test-key' });
    await provider.generateMusic({
      prompt: 'bright mandopop chorus for short video',
      instrumental: false,
      model: 'V5_5',
      callBackUrl: 'https://example.com/callback',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.kie.ai/api/v1/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          prompt: 'bright mandopop chorus for short video',
          customMode: false,
          instrumental: false,
          model: 'V5_5',
          callBackUrl: 'https://example.com/callback',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the provider test to verify it fails**

Run: `npx vitest run src/lib/generation/KieSunoProvider.test.ts`

Expected: FAIL with `provider.generateMusic is not a function`.

- [ ] **Step 3: Add KIE types**

In `src/types/kie.ts`, add:

```ts
export interface KieGenerateMusicRequest {
  prompt: string;
  instrumental: boolean;
  model: KieSunoModel;
  callBackUrl?: string;
}

export interface KieGenerateMusicStartResult {
  taskId: string;
}
```

- [ ] **Step 4: Implement the provider method**

In `src/lib/generation/KieSunoProvider.ts`, import the new types and add this method inside `KieSunoProvider`:

```ts
async generateMusic(input: KieGenerateMusicRequest): Promise<KieGenerateMusicStartResult> {
  const requestBody: Record<string, unknown> = {
    prompt: input.prompt,
    customMode: false,
    instrumental: input.instrumental,
    model: input.model,
  };

  const callBackUrl = input.callBackUrl || process.env.KIE_CALLBACK_URL;
  if (callBackUrl) {
    requestBody.callBackUrl = callBackUrl;
  }

  const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const payload = await this.parseJson<KieApiResponse<KieUploadCoverData>>(response);
  const taskId = payload.data?.taskId;

  if (!response.ok || payload.code !== 200 || !taskId) {
    throw new Error(payload.msg || `Kie generate-music task failed (${response.status})`);
  }

  return { taskId };
}
```

- [ ] **Step 5: Run the provider test**

Run: `npx vitest run src/lib/generation/KieSunoProvider.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/types/kie.ts src/lib/generation/KieSunoProvider.ts src/lib/generation/KieSunoProvider.test.ts
git commit -m "feat: add kie simple music generation"
```

## Task 3: Add Simple Generate API Route

**Files:**
- Create: `src/app/api/kie/simple-generate/route.ts`
- Create: `src/app/api/kie/simple-generate/route.test.ts`

- [ ] **Step 1: Write the failing empty-prompt route test**

Create `src/app/api/kie/simple-generate/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npx vitest run src/app/api/kie/simple-generate/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route**

Create `src/app/api/kie/simple-generate/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CreditService } from '@/lib/credits/CreditService';
import { getConsumeCreditsErrorMessage } from '@/lib/credits/consumeError';
import {
  getKieUserFacingErrorMessage,
  isKieProviderCreditsInsufficient,
  KieSunoProvider,
} from '@/lib/generation/KieSunoProvider';
import type { CreditOperationType } from '@/types/credits';
import type { KieSunoModel } from '@/types/kie';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL: KieSunoModel = 'V5_5';
const MODELS: KieSunoModel[] = ['V5_5', 'V5', 'V4_5PLUS', 'V4_5', 'V4'];
const SIMPLE_GENERATE_OPERATIONS: CreditOperationType[] = ['cover_generation'];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    const instrumental = body.instrumental === true;
    const modelRaw = String(body.model || DEFAULT_MODEL);
    const model = (MODELS.includes(modelRaw as KieSunoModel) ? modelRaw : DEFAULT_MODEL) as KieSunoModel;

    if (!prompt) {
      return NextResponse.json({ error: '请输入生成描述' }, { status: 400 });
    }

    if (prompt.length > 500) {
      return NextResponse.json({ error: '生成描述不能超过 500 个字符' }, { status: 400 });
    }

    const creditService = new CreditService(supabaseAdmin);
    if (!(await creditService.hasEnoughCredits(user.id, SIMPLE_GENERATE_OPERATIONS))) {
      return NextResponse.json({ error: 'Credits 余额不足，请先充值或升级套餐' }, { status: 402 });
    }

    const batchId = createId('kie-simple-batch');
    const localTaskId = createId('kie-simple-task');
    const title = prompt.slice(0, 40);

    const { error: batchError } = await supabaseAdmin.from('generation_batches').insert({
      id: batchId,
      user_id: user.id,
      template_id: null,
      prompt,
      title,
      generation_type: 'full_demo',
      use_premium_singer: false,
      version_count: 1,
      status: 'generating',
    } as any);

    if (batchError) {
      console.error('[kie/simple-generate] Create batch failed:', batchError);
      return NextResponse.json({ error: '创建创作记录失败，请稍后重试' }, { status: 500 });
    }

    const { error: taskError } = await supabaseAdmin.from('generation_tasks').insert({
      id: localTaskId,
      user_id: user.id,
      generation_type: 'full_demo',
      status: 'generating',
      prompt,
      title,
      template_id: null,
      model_id: `kie-suno-${model.toLowerCase()}`,
      audio_path: null,
      raw_audio_path: null,
      lyrics: instrumental ? null : prompt,
      song_structure: null,
      credits_consumed: 0,
      batch_id: batchId,
      version_number: 1,
      duration_seconds: null,
    } as any);

    if (taskError) {
      console.error('[kie/simple-generate] Create task failed:', taskError);
      await supabaseAdmin.from('generation_batches').delete().eq('id', batchId).eq('user_id', user.id);
      return NextResponse.json({ error: '创建创作任务失败，请稍后重试' }, { status: 500 });
    }

    const callBackUrl = `${req.nextUrl.origin}/api/kie/upload-cover/callback?localTaskId=${encodeURIComponent(localTaskId)}`;
    let result;
    try {
      result = await new KieSunoProvider().generateMusic({
        prompt,
        instrumental,
        model,
        callBackUrl,
      });
    } catch (error: any) {
      const rawMessage = error?.message || '简单模式生成任务创建失败';
      const errorMessage = getKieUserFacingErrorMessage(rawMessage) || rawMessage;
      await supabaseAdmin.from('generation_tasks').update({
        status: 'failed',
        error_code: isKieProviderCreditsInsufficient(rawMessage)
          ? 'KIE_PROVIDER_CREDITS_INSUFFICIENT'
          : 'KIE_SIMPLE_GENERATE_FAILED',
        error_message: errorMessage,
        credits_consumed: 0,
        updated_at: new Date().toISOString(),
      } as any).eq('id', localTaskId).eq('user_id', user.id);
      await supabaseAdmin.from('generation_batches').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      } as any).eq('id', batchId).eq('user_id', user.id);

      return NextResponse.json({ error: errorMessage }, {
        status: isKieProviderCreditsInsufficient(rawMessage) ? 503 : 500,
      });
    }

    const consumeResult = await creditService.consumeCredits(user.id, SIMPLE_GENERATE_OPERATIONS);
    if (!consumeResult.success) {
      const errorMessage = getConsumeCreditsErrorMessage(consumeResult.error);
      await supabaseAdmin.from('generation_tasks').update({
        status: 'failed',
        error_code: 'CREDITS_NOT_ENOUGH',
        error_message: errorMessage,
        credits_consumed: 0,
        updated_at: new Date().toISOString(),
      } as any).eq('id', localTaskId).eq('user_id', user.id);
      await supabaseAdmin.from('generation_batches').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      } as any).eq('id', batchId).eq('user_id', user.id);
      return NextResponse.json({ error: errorMessage, code: consumeResult.error }, { status: 402 });
    }

    await supabaseAdmin.from('generation_tasks').update({
      raw_audio_path: `kie:${result.taskId}`,
      credits_consumed: consumeResult.consumed,
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);

    return NextResponse.json({
      taskId: result.taskId,
      localTaskId,
      batchId,
      creationUrl: `/account/creations?expand=${encodeURIComponent(batchId)}`,
      statusUrl: `/api/kie/upload-cover/status?taskId=${encodeURIComponent(result.taskId)}&localTaskId=${encodeURIComponent(localTaskId)}`,
    });
  } catch (error: any) {
    console.error('[kie/simple-generate] Error:', error);
    return NextResponse.json({ error: error?.message || '简单模式生成失败，请稍后重试' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the route test**

Run: `npx vitest run src/app/api/kie/simple-generate/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- src/app/api/kie/simple-generate/route.ts src/app/api/kie/simple-generate/route.test.ts
git commit -m "feat: add kie simple generate api"
```

## Task 4: Add Simple Mode UI

**Files:**
- Create: `src/components/studio/SimpleGenerationTab.tsx`
- Modify: `src/app/studio/StudioPageClient.tsx`

- [ ] **Step 1: Create the simple tab component**

Create `src/components/studio/SimpleGenerationTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SimpleGenerationTab() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError('请输入生成描述');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/kie/simple-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, instrumental }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || '生成失败，请稍后重试');
      }
      router.push(data.creationUrl || `/account/creations?expand=${data.batchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section style={wrapStyle}>
      <div style={panelStyle}>
        <p style={eyebrowStyle}>简单模式</p>
        <h2 style={titleStyle}>不用选模板，直接生成歌曲</h2>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：一首适合短视频的华语流行歌，明亮、轻快、有记忆点副歌"
          maxLength={500}
          style={textareaStyle}
          disabled={isGenerating}
        />
        <div style={metaRowStyle}>
          <span>{prompt.trim().length}/500</span>
          <label style={toggleStyle}>
            <input
              type="checkbox"
              checked={instrumental}
              onChange={(event) => setInstrumental(event.target.checked)}
              disabled={isGenerating}
            />
            生成纯伴奏
          </label>
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          style={{
            ...buttonStyle,
            opacity: isGenerating || !prompt.trim() ? 0.55 : 1,
            cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {isGenerating ? '生成中...' : '开始生成'}
        </button>
      </div>
    </section>
  );
}

const wrapStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: '0 auto',
};

const panelStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid rgba(206, 255, 53, 0.18)',
  borderRadius: 12,
  padding: 24,
  color: '#f5f5f0',
};

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 8px',
  color: '#ceff35',
  fontSize: 13,
  fontWeight: 800,
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: 24,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 150,
  padding: 14,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,.16)',
  background: '#181818',
  color: '#fff',
  resize: 'vertical',
  boxSizing: 'border-box',
  fontFamily: 'var(--hc-font)',
  lineHeight: 1.6,
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 10,
  color: '#a8aaa3',
  fontSize: 13,
};

const toggleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(239, 68, 68, .12)',
  color: '#fecaca',
};

const buttonStyle: React.CSSProperties = {
  marginTop: 18,
  padding: '12px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#ceff35',
  color: '#111',
  fontWeight: 900,
};
```

- [ ] **Step 2: Render the tab in Studio**

In `src/app/studio/StudioPageClient.tsx`:

1. Add the import:

```ts
import SimpleGenerationTab from '@/components/studio/SimpleGenerationTab';
```

2. Add a tab button in the tab bar:

```tsx
<button
  onClick={() => setActiveTab('simple')}
  style={tabButtonStyle('simple')}
>
  简单模式
</button>
```

3. Add tab content before template generation content:

```tsx
<div style={{ display: activeTab === 'simple' ? 'block' : 'none' }}>
  <SimpleGenerationTab />
</div>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS. If existing unrelated errors appear, record them exactly and verify they are not from the modified files.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- src/components/studio/SimpleGenerationTab.tsx src/app/studio/StudioPageClient.tsx
git commit -m "feat: add studio simple mode ui"
```

## Task 5: Final Verification

**Files:**
- Verify all files touched in Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npx vitest run src/config/studioTabs.test.ts src/lib/generation/KieSunoProvider.test.ts src/app/api/kie/simple-generate/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS or only known unrelated baseline errors.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat HEAD`

Expected: no uncommitted implementation changes after task commits. Unrelated pre-existing workspace changes may remain.

- [ ] **Step 4: Optional browser check**

Run: `npm run dev`

Open `/studio`, verify:

- "简单模式" appears when included in Studio tab settings
- empty prompt blocks generation on the client
- non-empty prompt calls `/api/kie/simple-generate`
- successful response navigates to creation history

