# Studio Simple Mode Design

Date: 2026-06-25

## Goal

Add a lightweight "simple mode" to the Studio so users can generate music without choosing a template. The mode sends a text prompt to KIE Suno's generate-music endpoint and appears only when enabled from the existing admin Studio tab settings.

## Selected Approach

Use a new independent Studio tab named `simple` / "简单模式".

This keeps the new flow separate from template-based generation and reuses the current admin-controlled Studio tab visibility/default-tab system. It avoids a broader Studio homepage redesign.

## User Flow

1. User opens `/studio`.
2. If enabled, the Studio tab bar includes "简单模式".
3. User opens "简单模式" and enters one prompt describing the desired song.
4. User can choose the minimal options needed for KIE:
   - instrumental or vocal song
   - model, defaulting to the same KIE default used elsewhere when possible
5. User clicks generate.
6. The system creates a generation batch/task record, calls KIE generate-music, and navigates the user to creation history for result tracking.

## Admin Flow

The admin settings page keeps using the existing Studio Tab settings panel.

Add "简单模式" to `STUDIO_TAB_OPTIONS`, so admins can:

- show or hide the tab
- make it the default Studio tab

No separate feature-switch table is needed for the first version.

## API And Provider Design

Add a KIE provider method for text-to-music generation:

- endpoint: `/api/v1/generate`
- request mode: `customMode: false`
- required prompt: user-entered prompt
- no template ID
- optional `instrumental`, `model`, and callback URL

Add a thin Next.js API route, likely under `/api/kie/simple-generate`, that:

- authenticates the user
- validates prompt presence and length
- runs the existing sensitivity check path where practical
- checks/consumes credits using a scoped cost rule
- creates `generation_batches` and `generation_tasks` rows with `template_id: null`
- stores the returned KIE provider task ID as `raw_audio_path: kie:<taskId>`
- returns batch/task identifiers and a status URL

Use the existing KIE callback/status persistence path if compatible with generate-music response data. If a response shape differs, normalize it before persisting completed tracks.

## UI Design

Add a small `SimpleGenerationTab` component instead of expanding `StudioPageClient`.

The component should include:

- prompt textarea
- instrumental toggle
- generate button
- current credit/cost hint
- loading/error state

On success, route to `/account/creations?expand=<batchId>` to match existing generation flows.

## Data And Credits

Use `template_id: null` for simple-mode batches and tasks.

Add a cost rule only if the existing generation cost rules cannot clearly represent KIE simple generation. Prefer a single rule such as `simple_generation` to keep admin/accounting behavior explicit.

## Error Handling

Show user-facing errors for:

- simple mode disabled or missing from settings
- empty prompt
- insufficient user credits/previews
- KIE provider credits insufficient
- KIE task creation failure
- network or unexpected server errors

Provider-level KIE errors should be normalized through the existing KIE user-facing error helper.

## Testing

Add focused tests for:

- `normalizeStudioTabSettings` accepts the new `simple` tab and can set it as default
- KIE provider generate-music request uses `customMode: false` and does not send template-only fields
- API route rejects an empty prompt before calling KIE

Run:

- `npm run typecheck`
- relevant KIE/provider tests
- relevant Studio tab config tests

## Out Of Scope

- Making simple mode the Studio homepage
- Redesigning all Studio tabs
- Adding template selection inside simple mode
- Building advanced lyric/style controls in the first version
