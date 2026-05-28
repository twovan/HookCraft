# Stem Editor DAW Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing stem editor UI toward a compact DAW-style editing surface.

**Architecture:** Keep `StemMixerEditor.tsx` as the first-pass integration point and avoid changing audio state, caching, or export code. The first pass changes layout and canvas rendering styles only.

**Tech Stack:** Next.js, React, TypeScript, inline `CSSProperties`, Canvas waveform rendering.

---

### Task 1: Compact Timeline Visual Pass

**Files:**
- Modify: `src/components/studio/StemMixerEditor.tsx`

- [ ] **Step 1: Tighten track list container**

Change `trackListStyle` from a loose card stack into a compact timeline panel with a low gap, dark continuous background, and inner border.

- [ ] **Step 2: Tighten track rows**

Change `stemTrackStyle` padding, border radius, grid columns, and gap so rows read like DAW lanes instead of large cards.

- [ ] **Step 3: Tighten waveform canvas**

Change `waveformCanvasStyle` height and border radius, and add grid rendering in `WaveformTrackCanvas`.

- [ ] **Step 4: Run TypeScript**

Run: `npx tsc --noEmit --incremental false`

Expected: TypeScript passes.

### Task 2: Bottom Transport Layout Pass

**Files:**
- Modify: `src/components/studio/StemMixerEditor.tsx`

- [ ] **Step 1: Split the transport panel from the top workbench**

Move the playback controls toward a sticky bottom transport bar while keeping the same handlers.

- [ ] **Step 2: Keep inspector controls readable**

Keep selected-track controls and export panels in the upper/right inspector area.

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit --incremental false`

Expected: TypeScript passes.
