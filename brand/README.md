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

# Logo geometry → SVG variants → raster assets
bunx tsx scripts/build-brand-variants.ts   # SVG variants from master geometry
bunx tsx scripts/rasterize-brand.ts        # platform PNG/ICO assets
```

The first pipeline reads `brand/tokens.ts`. The second reads
`brand/fonts/Inter-ExtraBold.ttf` plus the flask/heart path constants
embedded in `scripts/build-brand-variants.ts`. Both are deterministic —
running them twice produces byte-identical output.

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

Chem IRL's mark is a geometric Erlenmeyer flask with a centered heart —
a simplification of the earlier illustrated mark (faces inside the flask)
into a form that reads instantly at 16px and reproduces reliably in
single-color applications.

Typography in the wordmark is **Inter ExtraBold** with glyphs outlined
as paths (no runtime font dependency). The `Chem` token uses the ink
color, `IRL` uses the aqua accent — matching the existing web nav
pattern where `IRL` is always highlighted.

### Logo files

| File | Purpose | Colors |
|---|---|---|
| `logo.svg` | Primary lockup (icon + wordmark) | aqua flask, gold heart, ink "Chem", aqua "IRL" |
| `logo-icon.svg` | Mark only, square | aqua flask, gold heart |
| `logo-wordmark.svg` | Wordmark only | ink "Chem", aqua "IRL" |
| `logo-mono-black.svg` | Full lockup, single-color | `#0B1220` |
| `logo-mono-white.svg` | Full lockup, reversed | `#FFFFFF` (for dark backgrounds) |
| `logo-aqua.svg` | Full lockup, brand aqua | `#0A7F74` |
| `logo-gold.svg` | Full lockup, brand gold | `#CA8A04` |

## Usage rules

### Clear space

Maintain at least **one cap-height** of empty space around the full
lockup on all sides. For `logo-icon.svg` alone, maintain 12.5% of the
mark's width as clearspace.

### Minimum sizes

- Full lockup (`logo.svg`): **96px** wide minimum. Below that, the
  wordmark loses legibility — switch to icon-only.
- Icon (`logo-icon.svg`): **16px** minimum. Below that, the heart
  detail disappears — the flask silhouette alone is still acceptable.

### Do

- Use `logo.svg` on light backgrounds (white, `#FFFBF7`).
- Use `logo-mono-white.svg` on brand aqua, ink, or photographic backgrounds.
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

`brand/fonts/Inter-ExtraBold.ttf` is checked in as a build input for the
wordmark path generation. It's used at build time only — the delivered SVGs
embed outlined paths, not `<text>` elements, so consumers have no runtime
font dependency. Inter is licensed under the SIL Open Font License
(`brand/fonts/Inter-LICENSE.txt`).

## Trademark status

To be filed: USPTO TESS sweep for "Chem IRL" word mark and the design
mark in class 9 (mobile apps) and class 45 (dating services). Until filed,
the logo is an unregistered mark — use the ™ symbol in public contexts.
Document filing outcome here once complete.
