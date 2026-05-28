# HookCraft Style DNA Design

Date: 2026-05-27

## Scope

Build a new Style DNA workflow alongside the existing upload, template analysis, MiniMax, and Kie/Suno generation flows. The current pages and APIs remain available. The first implementation targets an independent Style DNA workbench page that can later be folded into the existing Studio tabs.

The workflow is:

1. User uploads one or more reference tracks.
2. Server analyzes each track with Google audio analysis and saves a structured `TrackAnalysis`.
3. Server aggregates the analyses into an editable `StyleDNA`.
4. `PromptComposer` converts the Style DNA into a `SunoPromptPackage`.
5. User reviews or edits the Style DNA and prompt package.
6. User submits the package to the current Kie/Suno provider.
7. User can save feedback and generate a new prompt version without overwriting prior versions.

## Existing System

The project is a Next.js 14 App Router application with React 18, TypeScript, Supabase Auth/Postgres/Storage, and Vercel-style route handlers. Existing generation providers include Kie/Suno and MiniMax. Existing persistent generation records live in `generation_batches` and `generation_tasks`.

Current relevant files:

- `src/app/admin/templates/page.tsx`: admin template upload and browser-side Gemini analysis.
- `src/lib/admin/TemplateAdminService.ts`: older server-side Gemini template analysis.
- `src/app/api/admin/templates/[id]/save-analysis/route.ts`: saves Lyria/Suno template analysis fields.
- `src/components/studio/AdvancedArrangementTab.tsx`: user reference arrangement UI using Kie/Suno.
- `src/app/api/kie/upload-cover/route.ts`: creates Kie/Suno upload-cover tasks.
- `src/app/api/kie/add-instrumental/route.ts`: creates Kie/Suno add-instrumental tasks.
- `src/lib/generation/KieSunoProvider.ts`: Kie API wrapper.
- `supabase/migrations/002_create_tables.sql` and `008_multi_version_generation.sql`: existing templates, generation tasks, and batch tables.

## Problems To Solve

The current Suno template flow asks Gemini to produce a final prompt directly. This makes the output hard to validate, hard to edit, and hard to reuse across multiple songs. The prompt templates are duplicated between frontend and backend. The browser-side Gemini path exposes the Gemini key to an admin browser. Existing storage only keeps final analysis/prompt fields on `templates`, not per-track analysis, aggregation rationale, prompt versions, or feedback.

The new flow separates analysis, aggregation, composition, generation, and refinement.

## Data Model

Add these Supabase tables in a new migration.

### `style_dna_jobs`

Tracks the workflow status for a user-owned Style DNA analysis job.

Fields:

- `id text primary key`
- `user_id uuid references auth.users(id)`
- `name text`
- `status text`: `pending | analyzing | aggregating | prompt_ready | generating | completed | failed`
- `error_message text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `style_dna_source_tracks`

Stores uploaded reference track metadata.

Fields:

- `id text primary key`
- `job_id text references style_dna_jobs(id)`
- `user_id uuid references auth.users(id)`
- `file_name text`
- `storage_path text`
- `public_url text`
- `mime_type text`
- `size_bytes integer`
- `duration_seconds numeric`
- `status text`: `pending | analyzing | completed | failed`
- `error_message text`
- `created_at timestamptz`

### `track_analyses`

Stores one structured Google analysis per source track.

Fields:

- `id text primary key`
- `job_id text references style_dna_jobs(id)`
- `source_track_id text references style_dna_source_tracks(id)`
- `user_id uuid references auth.users(id)`
- `title text`
- `duration numeric`
- `confidence numeric`
- `bpm_estimate numeric`
- `bpm_range text`
- `key_estimate text`
- `mode text`
- `genre_candidates text[]`
- `mood_tags text[]`
- `energy_curve jsonb`
- `section_map jsonb`
- `instrumentation jsonb`
- `drum_style jsonb`
- `bass_style jsonb`
- `harmony_style jsonb`
- `arrangement_density jsonb`
- `vocal_presence text`
- `production_texture jsonb`
- `mix_traits text[]`
- `signature_arrangement_moves text[]`
- `avoid_elements text[]`
- `raw_google_response jsonb`
- `created_at timestamptz`

### `style_dnas`

Stores the editable aggregated style profile.

Fields:

- `id text primary key`
- `job_id text references style_dna_jobs(id)`
- `user_id uuid references auth.users(id)`
- `name text`
- `source_track_ids text[]`
- `summary text`
- `genre text[]`
- `tempo_range text`
- `key_mood text`
- `primary_instruments text[]`
- `secondary_instruments text[]`
- `drum_pattern text`
- `bass_pattern text`
- `harmony_language text`
- `arrangement_formula jsonb`
- `section_structure jsonb`
- `production_texture text`
- `emotional_arc text`
- `chinese_pop_specific_traits text[]`
- `suno_friendly_style_tags text[]`
- `avoid_tags text[]`
- `high_frequency_traits text[]`
- `low_frequency_traits text[]`
- `uncertain_traits text[]`
- `confidence numeric`
- `version integer`
- `created_at timestamptz`
- `updated_at timestamptz`

### `suno_prompt_packages`

Stores composed prompt versions.

Fields:

- `id text primary key`
- `style_dna_id text references style_dnas(id)`
- `job_id text references style_dna_jobs(id)`
- `user_id uuid references auth.users(id)`
- `title text`
- `style_prompt_short text`
- `style_prompt_medium text`
- `style_prompt_long text`
- `style_prompt text`
- `lyric_prompt text`
- `instrumental_prompt text`
- `structure_prompt text`
- `negative_prompt text`
- `custom_mode boolean`
- `instrumental boolean`
- `provider_payload jsonb`
- `prompt_version integer`
- `change_summary text`
- `created_at timestamptz`

### `generation_feedback`

Stores feedback and refinement intent.

Fields:

- `id text primary key`
- `generation_id text`
- `prompt_package_id text references suno_prompt_packages(id)`
- `style_dna_id text references style_dnas(id)`
- `user_id uuid references auth.users(id)`
- `rating integer`
- `feedback_text text`
- `too_electronic boolean`
- `too_rock boolean`
- `too_generic boolean`
- `drums_too_heavy boolean`
- `chorus_not_big_enough boolean`
- `vocal_not_forward boolean`
- `not_mandarin_pop_enough boolean`
- `harmony_too_simple boolean`
- `arrangement_too_flat boolean`
- `emotion_not_progressive boolean`
- `melody_mismatch boolean`
- `arrangement_mismatch boolean`
- `vocal_mismatch boolean`
- `structure_mismatch boolean`
- `suggested_changes text`
- `created_at timestamptz`

## TypeScript Modules

Add these modules:

- `src/types/style-dna.ts`: public types for `TrackAnalysis`, `StyleDNA`, `SunoPromptPackage`, `GenerationFeedback`, and job statuses.
- `src/lib/style-dna/googlePrompts.ts`: strict JSON prompts for single-track analysis and multi-track aggregation.
- `src/lib/style-dna/jsonRepair.ts`: extracts, parses, validates, and normalizes Google JSON output.
- `src/lib/style-dna/GoogleAudioAnalysisProvider.ts`: server-side provider wrapper around `@google/genai`.
- `src/lib/style-dna/StyleDnaAggregator.ts`: combines local aggregation helpers with the Google aggregation prompt.
- `src/lib/style-dna/PromptComposer.ts`: deterministic conversion from Style DNA to Suno prompt package and Kie payload.
- `src/lib/style-dna/PromptRefiner.ts`: creates prompt V2+ from feedback without overwriting V1.
- `src/lib/style-dna/safety.ts`: removes artist/song-name imitation language and blocks unsafe final prompt phrases.

## API Design

### `POST /api/style-dna/analyze`

Accepts multipart audio files. Auth required.

Steps:

1. Validate file count, MIME type, and size.
2. Create `style_dna_jobs`.
3. Upload files to Supabase Storage.
4. Create `style_dna_source_tracks`.
5. Analyze each track sequentially or with low concurrency.
6. Save `track_analyses`.
7. Aggregate analyses into `style_dnas`.
8. Compose initial `suno_prompt_packages` V1.
9. Return job, Style DNA, prompt package, and warnings.

Limits for first version:

- Minimum: 1 track.
- Maximum: 5 tracks.
- Accepted formats: MP3/WAV initially, matching current Kie path.
- Low confidence analyses are saved but surfaced as warnings.

### `GET /api/style-dna/[id]`

Returns job, source tracks, analyses, Style DNA, prompt versions, and linked generation metadata.

### `PATCH /api/style-dna/[id]`

Updates editable Style DNA fields and recomposes a new prompt version.

### `POST /api/style-dna/[id]/compose`

Explicitly recomposes a prompt package from the latest Style DNA.

### `POST /api/style-dna/[id]/generate`

Submits the latest or selected prompt package to the current Kie/Suno provider. It creates `generation_batches` and `generation_tasks` consistently with existing Kie routes, then returns the Kie task id and local task id.

For Kie upload-cover:

- `uploadUrl`: uploaded reference track URL, chosen from user selection or first source track.
- `prompt`: lyric or structure prompt.
- `style`: composed style prompt.
- `title`: package title.
- `negativeTags`: negative prompt when supported by the route.
- `customMode`: true.
- `instrumental`: package instrumental flag.
- `model`: current default `V5_5`.

If the provider does not support a native negative field, the avoid section is appended to the prompt text as `Avoid: ...`.

### `POST /api/style-dna/[id]/feedback`

Saves `generation_feedback`, calls `PromptRefiner`, and creates a new `suno_prompt_packages` version with a `change_summary`.

## UI Design

Add a new page at `src/app/studio/style-dna/page.tsx` and a client component `StyleDnaWorkbench`.

Desktop layout:

- Left rail: reference tracks, upload controls, per-track status, confidence, summary snippets, warnings.
- Center workspace: editable Style DNA fields.
- Right inspector: Suno Prompt Package preview, copy buttons, submit generation, version history, feedback controls.

Mobile layout:

- Vertical flow, no horizontal scrolling.
- Tabs or collapsible groups: Tracks, Style DNA, Prompt, Feedback.
- Primary buttons are at least 44px tall.

Editable fields:

- Genre
- BPM range
- Mood/key mood
- Primary instruments
- Drum pattern
- Bass pattern
- Harmony language
- Section formula
- Production texture
- Avoid tags

Prompt preview:

- Short, medium, and long style prompt.
- Structure prompt.
- Negative prompt.
- Provider payload JSON preview.
- One-click copy for each block.

Generation and feedback:

- Generate button disables during submission.
- Status shows pending, generating, completed, failed.
- Feedback chips include too electronic, too rock, too generic, drums too heavy, chorus not big enough, vocal not forward, not Mandarin pop enough, harmony too simple, arrangement too flat, emotion not progressive, plus free text.
- Refining creates V2 and preserves V1 in history.

Visual direction:

Use the existing HookCraft dark studio palette and CSS variables. The workbench should feel like a professional music production surface: dense but calm, three-pane scanning, restrained lime/cyan accents, waveform/audio context, and compact editable controls. Avoid marketing hero treatment.

## Prompt Rules

The Google analysis prompt must produce strict JSON only. It must not generate a Suno prompt. It must not mention copyrighted artist names or imply imitation.

The aggregation prompt receives structured analyses and outputs shared Style DNA only. It must not mention artist names or song titles in the final style description.

The final Suno prompt is created by `PromptComposer`, not directly by Google. It emphasizes genre, BPM, mood, instruments, drums, bass, harmony, section structure, production texture, and avoid elements.

The safety module removes or flags:

- `like [artist]`
- `in the style of [artist]`
- direct artist, song, or producer imitation phrasing
- song title references in final prompts

## Error Handling

Handle:

- Google analysis failure: mark track failed and keep job recoverable.
- Google non-JSON: attempt extraction/repair once, then fail with raw output stored.
- Low confidence: show warning and include in aggregation with lower weight.
- One uploaded song: produce single-track Style DNA with lower aggregation confidence.
- Too many songs: reject above limit before upload.
- Unsupported format: reject before upload.
- Duplicate generate click: disable and idempotently guard.
- Kie/Suno async task id: save remote and local task IDs.
- Long-running generation: reuse current polling timeout behavior and show recovery link/history.

## Testing And Verification

Add focused unit tests for:

- JSON extraction/normalization.
- PromptComposer copyright-safe output.
- StyleDNA aggregation helpers.
- PromptRefiner version preservation.

Run:

- `npm run typecheck`
- `npm run test`
- `npm run build`

There is no `lint` script in the current `package.json`, so lint is not part of the first verification command set unless a script is added later.

## Non-Goals For First Version

- Do not remove current template analysis or existing Studio generation flows.
- Do not migrate old `templates.suno_prompt` data.
- Do not introduce a separate queue service.
- Do not implement provider abstraction beyond a clean module boundary around Google analysis and Kie/Suno generation.
- Do not support artist-name style cloning.

## Rollout

The new route is additive. Existing users can continue using the current Studio and template workflows. The Style DNA workbench can later become a Studio tab once the workflow is validated.
