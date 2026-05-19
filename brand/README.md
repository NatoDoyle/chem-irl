# Chem IRL — Brand

Single source of truth for the Chem IRL brand: visual identity, design tokens,
user-facing copy, and product strategy. Every per-app brand file is generated
from or governed by something in this directory.

## Contents

| File | Purpose |
|---|---|
| [`tokens.ts`](./tokens.ts) | **Canonical design tokens.** Colors, typography, spacing, gradients, animations, user-facing copy. Generates `mobile/src/config/brand.ts`, `web/src/config/brand.ts`, and the `@theme` block of `web/src/app/globals.css`. |
| [`MESSAGES.md`](./MESSAGES.md) | **Voice & copy reference.** Tone of voice, how to write new user-facing strings, where to put them. |
| [`PRODUCT.md`](./PRODUCT.md) | **Product definition.** What Chem IRL is, what it isn't, who it's for. The decision filter for every feature. |
| `logo*.svg` | **Logo source files.** See _The mark_ below. |
| `fonts/` | Build-time font input for wordmark path generation (not shipped at runtime). |
| `archive/`, `working/`, `logo-ideas/` | Iteration scratch — gitignored except `archive/`. |

## Generating downstream artifacts

Two pipelines convert this directory's canonical sources into per-app artifacts:

```bash
# Design tokens → per-app TS + Tailwind @theme block
bun run brand:tokens   # regenerate from tokens.ts
bun run brand:check    # CI guard: exits 1 on drift

# Logo lockup → consumed SVGs → raster assets
bunx tsx scripts/split-brand-lockup.ts     # slice Chem IRL.svg → logo/icon/wordmark
bunx tsx scripts/rasterize-brand.ts        # platform PNG/ICO assets
```

The first pipeline reads `brand/tokens.ts`. The second slices the canonical
lockup `brand/Chem IRL.svg` into the three consumed SVGs (`logo.svg`,
`logo-icon.svg`, `logo-wordmark.svg`) — glyphs are pre-outlined in the
source, so there is no font input — then rasterizes them. Both are
deterministic — running them twice produces byte-identical output.

## Palette quick reference

Authoritative values live in [`tokens.ts`](./tokens.ts). This table is for
human lookup only — if it disagrees with `tokens.ts`, `tokens.ts` wins.

- **Aqua primary** — `#0A7F74` (`aqua-600`)
- **Gold accent** — `#CA8A04` (`gold-600`)
- **Coral warm** — `#F97316`
- **Ink** — `#0B1220`
- **Warm surface** — `#FFFBF7` / splash background `#F7FFFE`

## Typography

Both apps unify on:

- **Inter** (sans) — 400 / 500 / 600 / 700
- **Libre Caslon Text** (serif headlines) — 400 / 400 italic / 700

Loaded via `expo-font` on mobile (`mobile/src/lib/fonts.ts`) and via
`next/font/google` on web (`web/src/app/layout.tsx`). Token names live in
`TYPOGRAPHY_TOKENS` in [`tokens.ts`](./tokens.ts).

## The mark

Chem IRL's mark is a single-color aqua (`#0A7F74`) vertical lockup: two
interlocking rings cradling a heart, with white knockout shapes inside the
mark, set above the **Chem IRL** wordmark. It reads in one color and
reproduces reliably down to favicon sizes.

The canonical artwork is `brand/Chem IRL.svg`; `scripts/split-brand-lockup.ts`
slices it into the three consumed SVGs. The wordmark glyphs are pre-outlined
paths in the source (no runtime or build-time font dependency) and are a
single aqua color — there is no ink/aqua split.

### Logo files

| File | Purpose | Colors |
|---|---|---|
| `Chem IRL.svg` | **Canonical source lockup** — sliced by `split-brand-lockup.ts` | aqua `#0A7F74` + white knockouts |
| `logo.svg` | Primary lockup (mark + wordmark), generated | aqua `#0A7F74` |
| `logo-icon.svg` | Mark only, square, generated | aqua `#0A7F74` |
| `logo-wordmark.svg` | Wordmark only, generated | aqua `#0A7F74` |
| `logo-mono-black.svg` | Legacy old-flask variant — **not** regenerated from the new source | `#0B1220` |
| `logo-mono-white.svg` | Legacy old-flask variant — **not** regenerated from the new source | `#FFFFFF` |
| `logo-aqua.svg` | Legacy old-flask variant — **not** regenerated from the new source | `#0A7F74` |
| `logo-gold.svg` | Legacy old-flask variant — **not** regenerated from the new source | `#CA8A04` |

## Usage rules

### Clear space

Maintain at least **one cap-height** of empty space around the full
lockup on all sides. For `logo-icon.svg` alone, maintain 12.5% of the
mark's width as clearspace.

### Minimum sizes

- Full lockup (`logo.svg`): **96px** wide minimum. Below that, the
  wordmark loses legibility — switch to icon-only.
- Icon (`logo-icon.svg`): **16px** minimum. Below that, the heart
  detail disappears — the ring silhouette alone is still acceptable.

### Do

- Use `logo.svg` on light backgrounds (white, `#FFFBF7`).
- On dark, brand-aqua, or photographic backgrounds, render the mark in
  white (the social card does this) rather than the aqua source as-is.
- Use `logo-icon.svg` on its own when space is constrained.
- Keep the mark vertical and proportional — never rotate or skew.

### Don't

- Don't stretch, squash, or alter the aspect ratio.
- Don't recolor outside the palette.
- Don't add drop shadows, glows, or outlines — the mark is flat-only.
- Don't place on busy photographic backgrounds without a solid panel.
- Don't reconstruct the mark from scratch in-code. Always import these SVGs.

## Contexts and file map

| Context | Source SVG | Output asset |
|---|---|---|
| Mobile auth screen lockup | `logo.svg` | `mobile/assets/logo-full.png` (727×800) |
| iOS app icon (opaque) | `logo-icon.svg` | `mobile/assets/icon.png` (1024×1024, `#F7FFFE` bg) |
| Android adaptive foreground | `logo-icon.svg` | `mobile/assets/adaptive-icon.png` (1024×1024, transparent, inner 88%) |
| Splash screen mark | `logo-icon.svg` | `mobile/assets/splash-icon.png` (1024×1024) |
| Mobile web favicon | `logo-icon.svg` | `mobile/assets/favicon.png` (48×48) |
| Web marketing lockup | `logo.svg` | `web/public/logo.png` (200×220) |
| Web nav/footer icon | `logo-icon.svg` | `web/public/logo-icon.png` (64×64) |
| Next.js metadata icon | `logo-icon.svg` | `web/src/app/icon.png` (512×512) |
| Apple touch icon (opaque) | `logo-icon.svg` | `web/src/app/apple-icon.png` (180×180, white bg) |
| Browser favicon | `logo-icon.svg` | `web/src/app/favicon.ico` (16/32/48 multi-res) |
| Social share card | composed | `web/src/app/opengraph-image.png` (1200×630) |

## Why Inter TTF is in this repo

`brand/fonts/Inter-ExtraBold.ttf` was historically the build input for
wordmark path generation. The wordmark is now pre-outlined directly in
`brand/Chem IRL.svg`, so the logo pipeline no longer reads this font — it
is retained only as a brand-kit reference. The delivered SVGs embed
outlined paths, not `<text>` elements, so consumers have no runtime font
dependency. Inter is licensed under the SIL Open Font License
(`brand/fonts/Inter-LICENSE.txt`).

## Trademark status

To be filed: USPTO TESS sweep for "Chem IRL" word mark and the design
mark in class 9 (mobile apps) and class 45 (dating services). Until filed,
the logo is an unregistered mark — use the ™ symbol in public contexts.
Document filing outcome here once complete.
