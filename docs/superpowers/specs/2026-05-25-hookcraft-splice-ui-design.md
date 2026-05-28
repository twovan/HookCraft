# HookCraft Splice-Inspired UI Design

Date: 2026-05-25
Status: Ready for review

## Direction

Use a hybrid of:

- Splice-like discovery and marketplace structure for the homepage, template library, producer sections, and audio browsing.
- HookCraft-first AI Studio for generation workflows, prompt input, template selection, credits, safety checks, and results.

The UI should feel like a serious music creation product rather than a generic AI landing page. It should show real product surfaces immediately: playable template cards, genre filters, a generation panel, and output/version states.

## Product Goals

The redesign should make three things obvious within the first screen:

1. HookCraft helps creators start from proven musical hooks and templates.
2. Users can generate AI demos quickly from templates or custom prompts.
3. The platform has commercial and copyright-safety awareness, not just casual music generation.

Primary conversion path:

`Home discovery -> Template or Studio -> Generate -> Review versions -> Download or manage creation`

Secondary conversion path:

`Home discovery -> Template marketplace -> Template detail -> Buy/use template -> Studio`

## Information Architecture

Top navigation:

- Logo: HookCraft
- Explore: homepage/discovery
- Templates: marketplace and filters
- Studio: generation workspace
- Producers: curated creators
- Pricing: membership and credits
- Account: creations, credits, profile

Homepage sections:

- Hero with product UI and AI-generated music artwork, not a marketing-only banner.
- Featured hooks/templates with audio preview controls.
- Genre lanes: Pop, EDM, Hip-Hop, Lo-Fi, Rock, Jazz, Chinese Pop.
- Producer picks.
- "Create from template" strip that links into Studio.
- Copyright-safe creation message.
- Pricing/credits teaser.

Template library:

- Left or top filter area depending on viewport.
- Dense grid of cards with cover, play control, title, producer, tags, BPM/key/duration, price/license state, and primary action.
- Sorting by newest, popular, price, and recently used.

Studio:

- Productive two-column workspace on desktop.
- Left column: template browser or selected template, prompt, lyrics, generation controls.
- Right column: credits/plan state, generation preview, safety notes, result versions.
- Mobile stacks as: selected template, prompt, controls, generate button, results.

## Visual Language

Overall tone:

- Modern music software, premium but practical.
- Dark interface with high-contrast content surfaces.
- Sharp, rhythm-based layout inspired by DAWs, sample grids, waveform lanes, and album covers.

Avoid:

- Purple-only gradients.
- Generic AI glow/orb backgrounds.
- Oversized marketing hero cards.
- Decorative cards inside cards.
- Text-heavy feature explanations on first screen.

Recommended palette:

- Background: `#08090C`
- Surface: `#111217`
- Elevated surface: `#181A22`
- Border: `rgba(255,255,255,0.10)`
- Primary action acid-lime: `#CEFF35`
- Secondary coral: `#FF5A3D`
- Cyan accent: `#52D6C6`
- Text primary: `#F4F1EA`
- Text secondary: `#A8AAA3`
- Muted text: `#70746C`
- Warning/safety: `#F5C542`
- Error: `#FF5A5F`
- Success: `#5CE08A`

Use lime for primary actions and active states. Use coral and cyan sparingly for tags, template art, waveform accents, and status highlights.

## Typography

Use system Chinese-safe typography unless a font package is added later.

- Font stack: `Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- Display hero: 56-72 desktop, 36-44 mobile, weight 800-900
- Page title: 36-44 desktop, 28-34 mobile, weight 750-850
- Section title: 24-32 desktop, 22-26 mobile, weight 750
- Card title: 15-18, weight 650-750
- Body: 14-16, weight 400-500
- Metadata: 11-13, weight 500-700

Letter spacing should stay at `0`. Do not scale font size with viewport width.

## Layout Standards

Breakpoints:

- Mobile: 360-767
- Tablet: 768-1023
- Desktop: 1024-1439
- Wide: 1440+

Spacing:

- Page horizontal padding: 20 mobile, 32 tablet, 48 desktop.
- Section vertical spacing: 56 mobile, 80 desktop.
- Card radius: 8px.
- Button radius: 999px for pill actions, 8px for icon/tool controls.
- Grid gap: 16 mobile/tablet, 20-24 desktop.

Homepage hero:

- Full-width band, not a floating card.
- Left side or center: brand/product message and CTA.
- Right side or background: product interface fragment plus AI-generated image assets.
- Must show a hint of next content below the fold.

Template grid:

- Desktop: 4 columns at 1200+ width, 3 columns at 1024, 2 tablet, 1 mobile.
- Fixed cover aspect ratio: 1:1 for template cards, 16:9 for feature banners.
- Hover reveals play action without shifting layout.

Studio:

- Desktop grid: `minmax(360px, 440px) minmax(0, 1fr)`.
- Generation button can be sticky at bottom of control column.
- Controls should use segmented controls, toggles, sliders, and selects where appropriate.
- Version results should behave like audio rows/cards with clear selected state.

## Component Standards

Navigation:

- Sticky top nav with translucent dark surface and real contrast.
- Active item uses lime underline or filled pill.
- Account/credits area should show compact balance.

Template card:

- Cover image.
- Play/pause icon button.
- Title and producer.
- Tags: genre, mood, BPM, key, vocal/instrumental.
- Price or "Included".
- Primary action: Use, Buy, or Add to cart.
- Hover/active state must not resize the card.

Audio preview:

- Use a familiar play icon.
- Show waveform or simple progress bar.
- Keep controls accessible by keyboard.

Filters:

- Use checkboxes for multi-select genres/moods.
- Use radio/segmented controls for free/paid/all.
- Use range inputs for BPM/price only if implemented functionally.

Studio generation panel:

- Template selector.
- Prompt input.
- Instrumental/vocal toggle.
- Voice gender segmented control when vocal is enabled.
- Duration segmented control.
- Credits cost preview.
- Safety/copyright link as supporting text, not dominant copy.

Result/version card:

- Version number.
- Status.
- Audio player.
- Prompt/style metadata.
- Select, download, and retry actions.

## AI Image2 Asset System

`image2` means AI-generated visual assets for the new HookCraft identity.

Asset families:

- Hero artwork: abstract but music-specific, with waveform ribbons, studio equipment hints, album-cover collage, and Chinese pop/commercial demo energy.
- Template covers: square album-art-like covers generated by genre/mood.
- Producer covers: editorial portrait or studio-scene artwork.
- Empty/loading states: small low-contrast music objects or waveform illustrations.

Rules:

- Do not imitate Splice assets directly.
- Use consistent lighting: dark studio base, lime/coral/cyan accents.
- Avoid generic neon orb backgrounds.
- Avoid unreadable AI text inside images.
- Keep important UI text outside bitmap images.

Suggested image prompts:

Hero:

```text
premium music production interface, abstract waveform ribbons, album cover grid, modern recording studio, dark graphite background, acid lime and coral accents, high contrast, editorial product photography style, no readable text, no logos
```

Template cover:

```text
square album cover for [GENRE] hook template, energetic waveform sculpture, modern music artwork, dark base, acid lime cyan coral accents, clean composition, no readable text, no logos
```

Producer feature:

```text
editorial music producer studio scene, laptop and audio controller, atmospheric but clear, dark graphite room, lime accent lights, premium commercial music production, no readable text, no logos
```

## Content Standards

Primary language should be Chinese for the current product, with concise English labels only where they are music-industry standard.

Use:

- "探索模板"
- "进入 AI Studio"
- "使用模板"
- "试听"
- "生成 2 个版本"
- "版权安全说明"
- "已包含"
- "加入购物车"

Avoid:

- Long hero copy.
- Garbled or encoded text.
- Decorative emojis in production UI.
- In-app text explaining obvious visual features.

## Accessibility And Responsiveness

- All interactive controls need visible focus states.
- Text contrast should pass normal dark-mode readability.
- Buttons need stable hit areas of at least 40px height.
- Audio controls need accessible names.
- Cards and buttons must not rely only on hover.
- Mobile should avoid sticky sidebars; filters become a top drawer or collapsible panel.

## Implementation Scope

This design spec covers public and user-facing surfaces:

- `src/app/page.tsx`
- `src/app/templates/page.tsx`
- `src/app/templates/[id]/page.tsx`
- `src/app/studio/StudioPageClient.tsx`
- `src/app/account/creations/page.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- shared studio, producer, membership, and template components
- `src/app/globals.css`

Admin pages are out of scope except for any style tokens needed to avoid conflicts.

## Technical Direction

Create shared design tokens in CSS variables:

- Colors
- Spacing
- Radius
- Shadows
- Typography
- Focus ring

Move repeated inline style patterns into reusable CSS classes or small components where it reduces duplication. Keep changes scoped and avoid a full design-system rewrite unless the implementation plan chooses that as a separate step.

Fix visible garbled Chinese copy while touching affected user-facing files.

## Testing And Verification

Implementation should be verified with:

- `npx tsc --noEmit`
- focused `npx vitest run` for changed logic if applicable
- manual desktop and mobile browser checks for:
  - homepage first viewport
  - template grid and filters
  - Studio generation controls
  - account creations/results
  - empty/loading/error states

Visual checks must confirm:

- no overlapping text
- no layout shift on card hover
- readable Chinese copy
- mobile cards and buttons fit their containers
- primary CTA is visually clear

## Open Decisions

These are implementation choices, not blockers:

- Whether to generate final `image2` assets during implementation or use placeholders first.
- Whether to introduce an icon library such as `lucide-react`.
- Whether to split the large Studio client into smaller components during UI work.

Recommended answers:

- Generate a small initial `image2` set for hero and sample template covers.
- Add `lucide-react` only if dependency installation is acceptable.
- Split Studio only where necessary to safely apply layout and style changes.
