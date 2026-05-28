# AI Music Demo Handoff Audit

Date: 2026-05-19
Auditor: Codex
Workspace: `D:\吕一帆'工作\声盾-音乐版权\ai-music-demo`

## 1. Project Snapshot

This is a Next.js 14 application for an AI music creation and music copyright/template workflow.

Main stack:

- Next.js App Router, React 18, TypeScript
- Supabase Auth, Database, Storage
- Zustand stores for membership, credits, cart
- Gemini/Lyria generation flow
- MiniMax music-cover upload/arrangement flow
- Vitest + fast-check test suite

There is no `README.md` at the project root. The most useful product/implementation context currently lives in `.kiro/specs`.

## 2. Current Git State

The working tree is not clean.

Tracked modified file:

- `src/components/Footer.tsx`
  - Copy changed from "高质量音乐模板交易平台..." to "用正版模板与 AI 工作流，让华语创作者快速完成可听 Demo。"

Untracked notable paths:

- `.kiro/specs/audio-upload-arrangement/`
- `.kiro/specs/prompt-sensitivity-filter/design.md`
- `.kiro/specs/prompt-sensitivity-filter/tasks.md`
- `scripts/import-lyrics-sensitive.mjs`
- `scripts/import-sensitive-words.mjs`
- `scripts/make-bucket-public.mjs`
- `scripts/test-gemini.mjs`
- `scripts/ChineseLyrics-master/`
- `scripts/sensitive-words/`

Do not assume these are disposable. They look like Kiro-generated or user-added work-in-progress assets.

## 3. Kiro Specs

Important Kiro documents:

- `.kiro/specs/audio-upload-arrangement/tasks.md`
- `.kiro/specs/audio-upload-arrangement/design.md`
- `.kiro/specs/audio-upload-arrangement/requirements.md`
- `.kiro/specs/prompt-sensitivity-filter/tasks.md`
- `.kiro/specs/prompt-sensitivity-filter/design.md`
- `.kiro/specs/prompt-sensitivity-filter/requirements.md`
- `.kiro/specs/template-auto-analysis/bugfix.md`

Encoding note: many Chinese comments and Kiro files display as mojibake in the terminal. The source files still type-check, but reading them through PowerShell may show broken text. Use an editor with the correct encoding when editing copy-heavy files.

## 4. Implemented Product Areas

### Public/user app

- Home/pricing/templates/cart/checkout/account pages under `src/app`.
- Studio page at `src/app/studio/page.tsx`.
- Login/auth callback flow under `src/app/login` and `src/app/auth/callback`.

### Studio generation

The studio page currently has two tabs:

- Template generation tab
  - Uses `TemplateSelector`, `PromptInput`, `DurationSelector`, `GenerationProgress`, `VersionPanel`.
  - Calls `/api/generate-batch`.
  - Runs sensitivity check before generation.

- Upload arrangement tab
  - Main component: `src/components/studio/AudioUploadTab.tsx`.
  - Uploads an audio reference, optionally preprocesses it, edits arrangement parameters, then calls `/api/minimax/generate`.
  - Supports one-step and two-step cover modes.

### Admin area

Admin routes exist under `src/app/admin`.

Notable modules:

- Dashboard/users/orders/revenue/review/templates/categories/producers.
- Sensitive words page: `src/app/admin/sensitive-words/page.tsx`.
- Sensitivity logs page: `src/app/admin/sensitivity-logs/page.tsx`.

Admin APIs live under `src/app/api/admin`.

### Supabase

Migrations live in `supabase/migrations`.

Notable caveat: there are two `008_*.sql` migration files:

- `008_multi_version_generation.sql`
- `008_producer_earnings.sql`

If the deployment process expects strictly ordered unique numeric prefixes, this should be normalized before a fresh database setup.

Additional SQL scripts outside migrations:

- `scripts/create-sensitivity-tables.sql`
- `scripts/add-rewrite-cache-column.sql`
- `scripts/add-song-metadata-columns.sql`
- `scripts/add-arrangement-generation-type.sql`
- `scripts/make-bucket-public.mjs`

These scripts appear important but may not be part of the formal migration chain.

## 5. Verification Baseline

Commands run:

```powershell
npx tsc --noEmit
```

Result: passed.

```powershell
npx vitest run
```

Result: failed.

Summary:

- 18 test files total
- 12 passed
- 6 failed
- 369 tests total
- 335 passed
- 34 failed

Failing test files:

- `src/lib/generation/MiniMaxProvider.test.ts`
- `src/lib/membership/MembershipService.test.ts`
- `src/lib/generation/MusicGenerationService.test.ts`
- `src/lib/credits/CreditService.test.ts`
- `src/lib/audio/validateAudioFile.test.ts`
- `src/lib/supabase/__tests__/properties.test.ts`

## 6. Main Risks Found

### R1. MiniMax generation skips credits precheck

File: `src/app/api/minimax/generate/route.ts`

The route creates `CreditService` and sets:

```ts
const operations: CreditOperationType[] = ['arrangement_generation'];
```

But the pre-generation `hasEnoughCredits` check is commented out with a TODO saying `CreditService.hasEnoughCredits` has a bug. Credits are only consumed after successful generation, and even consumption failures are logged without failing the response.

Impact:

- A user may generate without enough balance.
- If post-generation deduction fails, the user still receives the result.

Recommended next step:

- Fix `CreditService`/test mocks first, then restore balance precheck in `/api/minimax/generate`.

### R2. MiniMax generation skips local/Gemini sensitivity check

File: `src/app/api/minimax/generate/route.ts`

The planned sensitivity check for `prompt + lyrics` is commented out. The route currently relies on MiniMax safety behavior.

Impact:

- Upload arrangement is less protected than template generation.
- Kiro spec says this is implemented, but runtime code says it is not.

Recommended next step:

- Reuse `SensitivityFilterService` or `/api/sensitivity-check` behavior server-side in the MiniMax route.

### R3. Tests are behind current implementation

Several failures are caused by mismatch between current code behavior and test expectations.

Examples:

- `MiniMaxProvider.test.ts` expects base URL `https://api.minimax.io`; implementation uses `https://api.minimaxi.com`.
- Tests expect `is_instrumental`; provider does not send it.
- Tests expect generation timeout `300s`; implementation uses `290s`.
- `MusicGenerationService.test.ts` expects `full_demo_short`; implementation uses `full_demo_long`.
- Prompt tests expect raw prompt; implementation now appends vocal/Chinese-lyrics instructions.

Recommended next step:

- Decide whether tests or implementation represent the desired behavior.
- Update one side consistently before adding new feature work.

### R4. Supabase mocks in tests do not support current query chains

Many `CreditService` and property tests fail with:

```text
maybeSingle is not a function
```

This indicates test mocks are stale relative to the current service implementation.

Impact:

- The most critical credits logic cannot be trusted by tests yet.
- This is likely why `/api/minimax/generate` has credits precheck disabled.

Recommended next step:

- Fix the Supabase mock builder in tests to support `.maybeSingle()`, `.insert().select().single()`, and related chains used by current services.

### R5. `validateAudioFile` has at least one behavior/test mismatch

File: `src/lib/audio/validateAudioFile.test.ts`

Failure:

- Test expects audio duration over 180 seconds to return invalid.
- Current result returns valid in that test case.

Recommended next step:

- Inspect mock audio duration setup and `validateAudioFile.ts`. This may be a real validation gap or a bad test mock.

### R6. MiniMax upload requires public Storage URL

File: `src/app/api/minimax/upload/route.ts`

The route uploads to Supabase Storage bucket `generations`, then calls `getPublicUrl`. The comment says the bucket must be public.

Impact:

- If the bucket is private in production, MiniMax preprocess/generate may not be able to fetch the audio.

Recommended next step:

- Confirm `generations` bucket access policy.
- Prefer signed URLs if MiniMax accepts them long enough for processing.

### R7. Kiro task completion is optimistic

The Kiro task lists mark most core implementation tasks complete, including checkpoints that say tests pass. Current test run does not pass.

Impact:

- Treat Kiro checkboxes as implementation intent, not verified truth.

Recommended next step:

- Use tests and live manual flow as source of truth.

## 7. Key Files by Area

### Template/Lyria generation

- `src/app/studio/page.tsx`
- `src/app/api/generate-batch/route.ts`
- `src/lib/generation/MusicGenerationService.ts`
- `src/lib/generation/LyriaProvider.ts`
- `src/lib/template/TemplateService.ts`
- `src/lib/admin/TemplateAdminService.ts`

### MiniMax upload arrangement

- `src/components/studio/AudioUploadTab.tsx`
- `src/components/studio/AudioUploader.tsx`
- `src/components/studio/ArrangementParamsEditor.tsx`
- `src/components/studio/WaveformVisualizer.tsx`
- `src/app/api/minimax/upload/route.ts`
- `src/app/api/minimax/preprocess/route.ts`
- `src/app/api/minimax/generate/route.ts`
- `src/lib/generation/MiniMaxProvider.ts`
- `src/types/arrangement.ts`

### Audio utilities

- `src/lib/audio/validateAudioFile.ts`
- `src/lib/audio/fileToBase64.ts`
- `src/lib/audio/fileToBase64Worker.ts`
- `src/lib/audio/buildArrangementPrompt.ts`
- `src/lib/audio/validateLyricsStructure.ts`

### Sensitivity filter

- `src/app/api/sensitivity-check/route.ts`
- `src/hooks/useSensitivityCheck.ts`
- `src/lib/sensitivity/LocalWordMatcher.ts`
- `src/lib/sensitivity/GeminiSensitivityDetector.ts`
- `src/lib/sensitivity/SensitivityFilterService.ts`
- `src/lib/sensitivity/SensitivityLogService.ts`
- `src/lib/sensitivity/SensitiveWordAdminService.ts`
- `src/types/sensitivity.ts`

### Credits and membership

- `src/lib/credits/CreditService.ts`
- `src/store/creditStore.ts`
- `src/config/creditsCost.ts`
- `src/lib/membership/MembershipService.ts`
- `src/store/membershipStore.ts`
- `src/config/tierConfig.ts`

### Supabase

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/auth-helpers.ts`
- `src/lib/supabase/types.ts`
- `src/lib/supabase/mappers/*`
- `supabase/migrations/*`

## 8. Suggested Next Work Plan

### Phase 1: Stabilize tests and credits

1. Fix Supabase test mocks for `.maybeSingle()` and current query chains.
2. Decide current desired cost for full demo: `full_demo_short` vs `full_demo_long`.
3. Align `MusicGenerationService` tests with current prompt-building behavior.
4. Fix or update `validateAudioFile` duration test.
5. Restore passing `npx vitest run`.

Why first: credits safety is currently the biggest product and revenue risk.

### Phase 2: Restore MiniMax route protections

1. Re-enable credits precheck in `/api/minimax/generate`.
2. Re-enable server-side sensitivity check for prompt and lyrics.
3. Make credits deduction failure visible and actionable instead of silent.
4. Add targeted route tests for insufficient credits, sensitivity block/rewrite, MiniMax success, MiniMax failure.

### Phase 3: Verify end-to-end flows manually

Manual smoke checklist:

- Login redirects to `/studio`.
- Template generation with prompt only.
- Template generation with template only.
- Template generation with custom lyrics.
- Sensitivity block path.
- Sensitivity rewrite confirmation path.
- Upload MP3/WAV to arrangement tab.
- One-step MiniMax arrangement generation.
- Two-step preprocess + generation, if still intended.
- Credits balance before and after success.
- Failure does not deduct credits.
- Generated result appears in `/account/creations`.
- Download works.

### Phase 4: Clean handoff/doc debt

1. Add a real `README.md`.
2. Move loose SQL scripts into ordered Supabase migrations if they are production-required.
3. Decide whether large lyric/sensitive-word source data belongs in repo.
4. Add `.gitignore` entries if generated/import source files should not be committed.

## 9. Practical Notes for Future Development

- Prefer starting from the failing tests instead of adding a new feature immediately.
- Do not trust Kiro completion checkboxes without local verification.
- Avoid editing unrelated dirty files. `Footer.tsx` already has a user or prior-agent change.
- The project contains many Chinese UI strings; preserve encoding carefully.
- The current codebase uses inline styles extensively in frontend components. Follow that pattern unless doing a deliberate UI refactor.
- For new backend behavior, follow the existing service pattern under `src/lib/*` and keep route handlers thin when possible.

## 10. Immediate Recommendation

The best next task is:

> Fix the test/mocking baseline around `CreditService`, then restore credits precheck in `/api/minimax/generate`.

This unlocks the highest-risk disabled logic and makes future MiniMax work much safer.
