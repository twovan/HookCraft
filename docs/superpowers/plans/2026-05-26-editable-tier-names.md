# Editable Tier Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit public pricing tier names from the existing membership pricing admin screen.

**Architecture:** Reuse the existing `pricing` admin config record so the name travels with `monthlyPrice` and `yearlyPrice`. The public pricing merge keeps defaults for old records without a `name` field and overrides the tier card name when `name` is provided.

**Tech Stack:** Next.js App Router, TypeScript, Supabase JSONB admin config, Vitest.

---

### Task 1: Pricing Config Merge

**Files:**
- Modify: `src/types/admin.ts`
- Modify: `src/lib/pricing/publicPricingConfig.ts`
- Test: `src/lib/pricing/publicPricingConfig.test.ts`

- [ ] Add a failing test showing that an admin-provided `name` overrides the public tier card name while old pricing records without `name` still fall back to `TIER_CONFIGS`.
- [ ] Add optional `name?: string` to `AdminPriceConfig`.
- [ ] Merge `pricing.name` into returned tier configs only when the admin value is non-empty.
- [ ] Run `npm test -- src/lib/pricing/publicPricingConfig.test.ts`.

### Task 2: Admin Pricing Editor

**Files:**
- Modify: `src/app/admin/credits/pricing/page.tsx`

- [ ] Extend the local `PriceConfig` shape with optional `name?: string`.
- [ ] Normalize fetched pricing rows so legacy rows display the built-in label as the editable name.
- [ ] Add a "套餐名称" column and text input while editing.
- [ ] Save the edited `name` together with the existing price fields through `/api/admin/config/pricing`.

### Task 3: Verification

**Files:**
- Modify as needed based on type or test failures.

- [ ] Run `npm test -- src/lib/pricing/publicPricingConfig.test.ts`.
- [ ] Run `npm run typecheck`.
- [ ] Report any unrelated pre-existing worktree changes without reverting them.
