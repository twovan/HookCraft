# HookCraft Logo Motion Spec

## Source

- Input: `D:/吕一帆'工作/声盾-音乐版权/HookCraft logo PNG/HookCraft logo 02.png`
- Source dimensions: 114 x 141 px
- Output folder: `public/hookcraft-logo-motion/`

## Deliverables

- `logo.svg`: motion-ready SVG wrapper using the original PNG as the final artwork layer.
- `motion.css`: all animation timing, easing, effects, and reduced-motion behavior.
- `logo_motion.html`: standalone preview file.
- `hookcraft-logo-02.png`: local support asset copied from the source image so the SVG can resolve the final frame.

## Motion Direction

- Use case: web startup logo reveal.
- Duration: 1500ms.
- Tone: clean, premium, subtle elastic settle.
- Structure:
  - The full logo fades in from a slight downward offset and settles to scale 1.
  - A soft purple-white pulse expands inside the circular mark.
  - A narrow scan highlight sweeps across the mark.
  - Equalizer bars briefly rise and fade over the existing waveform texture.

## Final Frame

At 1500ms, the effect layers have opacity 0 and the base logo layer has opacity 1, scale 1, and no translation. The visible final frame is the original static PNG.

## Reduced Motion

`prefers-reduced-motion: reduce` disables all keyframe animation, shows the base logo immediately, removes drop shadow, and hides transient effect layers.

## QA Notes

- Open `logo_motion.html` in a browser to preview the startup reveal.
- Open `logo.svg` directly to confirm the SVG resolves its external CSS and local PNG.
- Confirm the final resting frame matches `hookcraft-logo-02.png`; all transient SVG effect layers fade out by the end of the 1500ms timeline.
- Generated QA screenshots:
  - `qa-screenshot.png`: HTML preview render captured during the reveal.
  - `qa-final-frame.png`: HTML preview render after virtual time advance.
  - `qa-svg-final-frame.png`: direct SVG final-frame render after virtual time advance.
