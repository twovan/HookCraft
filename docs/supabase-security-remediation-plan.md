# Supabase Security Remediation Plan

Date: 2026-05-27
Project inspected: HookCraft-SG (`rynzjinzpskrzawlhlgi`)

This document records the Supabase audit findings and a staged remediation plan. It is intentionally a plan only: no production data, schema, bucket, or application behavior has been changed as part of this note.

## Current Findings

### Auth and Sessions

- User auth uses Supabase Auth, but `src/contexts/AuthContext.tsx` writes `sb-access-token` and `sb-refresh-token` into JavaScript-readable cookies.
- The frontend monkey-patches `window.fetch` to attach the current access token to `/api/*` requests.
- `src/lib/supabase/auth-helpers.ts` accepts Authorization headers, custom token cookies, and standard Supabase SSR cookies.
- `isAdmin()` trusts `user.user_metadata.role`, which is user-editable and should not be used for authorization decisions.
- Admin auth is separate from Supabase Auth and uses `admin_accounts` plus a signed HttpOnly JWT cookie.
- Migration `007_admin_accounts.sql` seeds a default admin account (`admin` / documented password `admin123`). Production should verify this account is removed, disabled, or rotated.

### Publishing and Templates

- `/api/templates/upload` allows any logged-in user to submit a template through `supabaseAdmin`.
- New templates are inserted with `status = 'pending'`, which is good, but `category` comes from client input.
- `producer_id` is set to the authenticated user's `auth.users.id`, while the rest of the schema appears to treat `templates.producer_id` as a `producers.id`. This should be normalized.
- `/api/templates` treats template data as public and accepts `tier` from query params, so a client can claim a higher tier for listing/filtering.

### Storage

- Online buckets observed:
  - `avatars`: public, 5 MB limit, image MIME allowlist.
  - `generations`: public, no file size limit or MIME allowlist.
  - `template-assets`: public, no file size limit or MIME allowlist.
- `storage.objects` currently has RLS enabled but no policies.
- The code creates signed URLs for generated audio, but the `generations` bucket is public, so signed URLs do not currently enforce privacy.
- `template-assets` stores both public cover images and template reference audio. Because the bucket is public, reference audio may be publicly reachable even if older migration comments expected RLS to protect it.

### RLS and Database Security

Supabase security advisors reported:

- RLS enabled but no policies on:
  - `admin_accounts`
  - `operation_logs`
  - `platform_settings`
  - `producer_earnings`
  - `producer_invitations`
  - `purchased_credits`
  - `settlements`
  - `template_purchases`
- Overly permissive insert policies:
  - `memberships`
  - `credits`
  - `preview_counts`
- Public/signed-in execution allowed for `SECURITY DEFINER` functions:
  - `handle_new_user`
  - `upgrade_membership`
  - `rls_auto_enable`
- Mutable `search_path` warnings on functions such as:
  - `consume_credits_with_priority`
  - `update_sensitive_words_updated_at`
  - `upgrade_membership`
- Performance advisors also reported unindexed foreign keys and RLS init-plan optimization opportunities.

## Risk Assessment

### Low-Risk Fixes

These should have little or no impact on existing product behavior if implemented carefully:

- Add explicit deny-all RLS policies for server-only tables.
- Add user self-read policies for ledgers that users need to view.
- Add missing foreign-key indexes.
- Set fixed function `search_path`.
- Remove duplicate sensitivity policies after confirming the intended one.

### Medium-Risk Fixes

These can affect flows if any client-side code currently relies on broad policies:

- Remove wide insert policies from `memberships`, `credits`, and `preview_counts`.
- Revoke direct execute permissions from privileged RPC functions.
- Stop trusting `user_metadata.role`.
- Make template listing use the authenticated user's actual membership tier instead of a query param.

### High-Risk Fixes

These require coordinated code and storage changes:

- Convert `generations` from public to private.
- Split `template-assets` into separate public cover and private audio storage, or otherwise make reference audio private.
- Migrate existing public URLs or ensure all playback/download paths use server-generated signed URLs.

## Staged Remediation Plan

### Phase 0: Preparation

- Create a Supabase development branch or use a local database for rehearsal.
- Export current bucket settings, RLS policies, and function grants for rollback reference.
- Confirm whether any existing records store public URLs that must continue to resolve.
- Confirm whether the default admin account exists in production and rotate or disable it before broader changes.

### Phase 1: Safe Database Permission Cleanup

- Add explicit server-only policies to tables that currently have RLS enabled but no policies.
- Add self-read policies where user dashboards require visibility:
  - `purchased_credits`: users can read their own balance.
  - `credit_transactions`: users can read their own transactions.
  - `template_purchases`: users can read their own purchases.
- Keep admin-only and internal tables closed to anon/authenticated users:
  - `admin_accounts`
  - `operation_logs`
  - `platform_settings`
  - `producer_earnings`
  - `producer_invitations`
  - `settlements`
- Replace broad insert policies on `memberships`, `credits`, and `preview_counts` with server-only behavior.
- Add missing foreign-key indexes reported by advisors.

### Phase 2: Privileged Function Hardening

- Revoke `EXECUTE` on privileged functions from `anon` and `authenticated`:
  - `handle_new_user`
  - `upgrade_membership`
  - `rls_auto_enable`
- Set stable `search_path` on public functions.
- Prefer moving privileged RPC functions to a private schema or limiting them to service-role use.
- Verify sign-up still initializes membership, credits, and preview counts through the auth trigger.

### Phase 3: Auth Flow Cleanup

- Remove JavaScript-readable refresh-token cookies.
- Prefer standard `@supabase/ssr` session cookie handling for server routes.
- If Authorization headers remain, keep them access-token-only and avoid storing refresh tokens in JS-readable storage beyond Supabase's client session behavior.
- Remove `user_metadata.role` from authorization checks; use `app_metadata` or the separate admin session only.

### Phase 4: Publishing Model Cleanup

- Normalize producer identity:
  - Decide whether `templates.producer_id` references `producers.id` or `auth.users.id`.
  - Update API code and database constraints to match the decision.
- Require an active producer profile before allowing `/api/templates/upload`.
- Ignore client-provided dangerous fields:
  - `status`
  - `sales_count`
  - privileged `category` choices
- Keep new submissions as `pending` and publish only through an admin-reviewed flow.
- Ensure template list APIs filter by actual membership tier from the database.

### Phase 5: Storage Privacy Migration

- First update application code so generated audio playback/download always goes through a server route or signed URL.
- Convert `generations` to private after verifying no frontend relies on raw public URLs.
- Separate template covers from template reference audio:
  - Option A: keep `template-assets` public for covers only and move reference audio to a new private bucket.
  - Option B: make `template-assets` private and serve covers through signed/public proxy URLs.
- Add storage policies only if direct client uploads/downloads are needed. If the server uses service role for all storage writes, keep client writes closed.
- Add bucket MIME allowlists and file-size limits for generated audio, template audio, and cover images.

## Verification Checklist

Before applying to production:

- Run Supabase security advisors and performance advisors.
- Test as anonymous user:
  - Cannot access private tables.
  - Can view only public/free template metadata intended for public browsing.
  - Cannot access generated audio or private reference audio.
- Test as authenticated normal user:
  - Can view own membership, credits, purchases, generations, and downloads.
  - Cannot read or update another user's rows.
  - Cannot call privileged RPC functions.
- Test as producer:
  - Can submit a template only when producer status is active.
  - Cannot publish directly.
  - Cannot spoof `producer_id`, `status`, or privileged `category`.
- Test as admin:
  - Admin dashboard still works through admin session.
  - Template review, publish, cover/audio upload, and logs still work.
- Test audio flows:
  - Existing generated songs can still play.
  - Download endpoint still returns the expected MP3.
  - Signed URLs expire and cannot be reused indefinitely.
- Re-run advisors after migration and record remaining warnings.

## Do Not Change Yet

Until the implementation window:

- Do not change bucket public/private flags directly in production.
- Do not delete existing storage objects.
- Do not rewrite historical `audio_path`, `preview_url`, or `cover_url` values without a compatibility plan.
- Do not revoke privileged function access until sign-up, membership upgrade, and payment flows have been rehearsed.

