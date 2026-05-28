# Stem Editor DAW Polish Design

## Goal

Bring the stem editor closer to a professional DAW-style workspace while preserving HookCraft's current stem loading, cache, trim, mute, solo, save, and export behavior.

## Target Fidelity

The reference can be matched at about 75-85% visually for layout density, track rhythm, dark timeline feel, bottom transport direction, and compact controls. It should not be copied 1:1 because HookCraft is not a loop library or beat arranger. The right side should stay focused on selected-track controls, export readiness, cache status, and mix presets.

## Layout Direction

- Top: project identity, save state, edit/export utility actions.
- Center: compact multi-track timeline with bilingual track names on the left and waveform clips on the right.
- Right/upper inspector: selected track controls, mix presets, export settings, and readiness.
- Bottom direction: playback transport should move toward a fixed bottom bar in a later pass.

## Track Spacing Rule

Use DAW-style density, not card-style spacing:

- Track rows keep a small 4-6px gap.
- Waveform clips use minimal vertical padding.
- The timeline uses a continuous dark grid feel across rows.
- Selected rows are highlighted by border and subtle tint.
- Muted or inactive rows can dim, but should remain readable.

## First Implementation Slice

The first slice changes visual density only:

- Tighten track row spacing.
- Reduce row padding and waveform canvas height.
- Add grid lines inside waveform canvases.
- Make waveform clips feel more rectangular and timeline-like.
- Keep current audio and export logic untouched.

## Acceptance Criteria

- Track rows look compact and closer to the DAW reference.
- Waveforms no longer feel like large individual cards.
- There is still enough spacing to see selected track, mute/solo state, and trim handles.
- Existing playback, trim, solo, mute, cache, save, and export behavior still compiles.
