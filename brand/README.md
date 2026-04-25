# Chem IRL — Brand assets

Source-of-truth directory for the Chem IRL logo and related brand assets.
SVG masters here are the only authoritative vector artwork. Every raster
asset shipped in `mobile/assets/`, `web/public/`, and `web/src/app/` is
derived from these files via `scripts/rasterize-brand.ts`.

## The mark

Chem IRL's mark is a geometric Erlenmeyer flask with a centered heart —
a simplification of the earlier illustrated mark (faces inside the flask)
into a form that reads instantly at 16px and reproduces reliably in
single-color applications.

Typography in the wordmark is **Inter ExtraBold** with glyphs outlined
as paths (no runtime font dependency). The `Chem` token uses the ink
color, `IRL` uses the aqua accent — matching the existing web nav
pattern where `IRL` is always highlighted.

## Files

| File | Purpose | Colors |
|---|---|---|
| `logo.svg` | Primary lockup (icon + wordmark) | aqua flask, gold heart, ink "Chem", aqua "IRL" |
| `logo-icon.svg` | Mark only, square | aqua flask, gold heart |
| `logo-wordmark.svg` | Wordmark only | ink "Chem", aqua "IRL" |
| `logo-mono-black.svg` | Full lockup, single-color | `#0B1220` |
| `logo-mono-white.svg` | Full lockup, reversed | `#FFFFFF` (for dark backgrounds) |
| `logo-aqua.svg` | Full lockup, brand aqua | `#0A7F74` |
| `logo-gold.svg` | Full lockup, brand gold | `#CA8A04` |

## Palette

Defined once in `mobile/src/config/brand.ts` (aqua scale) and
`web/src/config/brand.ts`. Do not duplicate values here. Quick reference:

- **Aqua primary** — `#0A7F74` (`aqua-600`)
- **Gold accent** — `#CA8A04` (`gold-600`)
- **Coral warm** — `#F97316`
- **Ink** — `#0B1220`
- **Warm surface** — `#FFFBF7` / splash background `#F7FFFE`

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

## Regenerating assets

From the repo root:

```bash
bunx tsx scripts/build-brand-variants.ts   # rewrites all SVGs from source geometry
bunx tsx scripts/rasterize-brand.ts        # regenerates all 11 platform PNG/ICO assets
```

Both scripts are deterministic — running them twice produces byte-identical
output. The first reads `brand/fonts/Inter-ExtraBold.ttf` and the flask/heart
path constants embedded in `scripts/build-brand-variants.ts`.

### Why Inter TTF is in this repo

`brand/fonts/Inter-ExtraBold.ttf` is checked in as a build input for the
wordmark path generation. It's used at build time only — the delivered SVGs
embed outlined paths, not `<text>` elements, so consumers have no runtime
font dependency. Inter is licensed under the SIL Open Font License
(`brand/fonts/Inter-LICENSE.txt`).

## Scratch and iteration

`brand/working/` holds concept iterations, raster previews, and build-time
scratch files. It's gitignored — anything placed there is ephemeral.

## Archive

`brand/archive/Chemirl_logo.png` is the pre-revision illustrated master
(beaker with face silhouettes and cork stopper). Kept for reference only.

## Trademark status

To be filed: USPTO TESS sweep for "Chem IRL" word mark and the design
mark in class 9 (mobile apps) and class 45 (dating services). Until filed,
the logo is an unregistered mark — use the ™ symbol in public contexts.
Document filing outcome here once complete.
