# HookCraft Logo Motion Spec

## Source brief

- Source: `assets/logo.png`, copied from the provided HookCraft PNG.
- Source size: 114 x 141 px, RGBA with transparent background.
- Semantic parts: circular mark, violet spectrum bars/dots, floor glow, music note stem/head/flag, and individually addressable wordmark letters.
- Usage context: splash-style brand opening. Default duration is 1500ms, ending in the exact static logo state.

## Motion personality

- Brand words: melodic, luminous, crafted.
- Axis fit: medium-high energy and lightly playful, because the mark combines audio spectrum energy with a soft musical note and clean wordmark.
- Token basis: between Friendly / Approachable and Elegant / Premium.
- Duration: 1500ms to give the note and wordmark a deliberate reveal without becoming slow.
- Easing:
  - `--p2m-ease-enter: cubic-bezier(0.16, 1, 0.3, 1)`
  - `--p2m-ease-settle: cubic-bezier(0.22, 1, 0.36, 1)`
  - `--p2m-ease-narrative: cubic-bezier(0.34, 0, 0.14, 1)`

## Geometry strategy

The vector uses low-complexity primitives and a few smooth cubic paths instead of bitmap tracing:

- Disc: radial-gradient circle clipped at `cx=57 cy=49 r=49`.
- Spectrum: separate rounded bars and dots clipped to the disc.
- Note: cubic centerline stem with `pathLength="1"`, one rotated ellipse for the note head, and one filled flag path.
- Wordmark: live SVG text split into per-letter ids for staggered motion.

This intentionally favors clean editable geometry over exact pixel stair tracing. The remaining source differences are acceptable because the PNG contains glow, antialiasing, and raster softness that should not be preserved as jagged vector knots.

## SVG structure

- `#mark`
- `#disc`
- `#spectrum`
- `#spectrumDots`
- `#wave-floor`
- `#music-note`
- `#note-stem` with `pathLength="1"`
- `#note-head`
- `#note-flag`
- `#wordmark`
- `#letter-h`, `#letter-o1`, `#letter-o2`, `#letter-k`
- `#letter-c`, `#letter-r`, `#letter-a`, `#letter-f`, `#letter-t`

## Timeline

| Time | Phase | Action | Principles |
|---:|---|---|---|
| 0-300ms | Anticipation | Disc scales in from a soft, dim state; spectrum is hidden below the circle. | Staging, anticipation |
| 300-650ms | Action 1 | Spectrum bars rise with slight stagger; floor glow blooms. | Timing, overlapping action |
| 520-980ms | Action 2 | Music note draws on, then fills to its final luminous tone. | Slow in/out, solid drawing |
| 820-1240ms | Action 3 | Wordmark letters cascade upward, two rows reading as HOOK then CRAFT. | Staging, follow through |
| 1240-1500ms | Settle | All parts land with no deformation; glow breath settles to final. | Follow through, appeal |

The timeline follows the 20% / 50% / 30% anticipation-action-follow-through shape.

## Atomic motions in `logo_motion.html`

- Hover lift: the complete mark rises subtly and brightens.
- Spectrum pulse: bars animate independently to demonstrate audio energy.
- Note redraw: the note stem redraws quickly using the same `pathLength="1"` stroke.
- Letter cascade: the wordmark repeats the stagger as an isolated study.

## Tunable controls

- Replay restarts the main reveal deterministically.
- Slow motion toggles playback to 0.25x.
- Speed slider updates the currently running animation loop.
- Query hooks:
  - `?t=<ms>` seeks the main logo to an exact timestamp.
  - `?static=1` renders the final logo state.
  - `window.__p2mReady` is set after rendering or seeking.

## QA notes

- Geometry acceptance prioritizes smoothness and editable structure over maximum IoU.
- The note stem is a smooth cubic path, not a pixel trace.
- Key motion is driven by JavaScript seeking, so the Chromium keyframe `var()` timing-function trap is avoided.
- Reduced motion renders the final static state immediately.
- Expected deliverables: `logo.svg`, `logo_motion.html`, `motion_spec.md`, plus QA images under `outputs/`.
