#!/usr/bin/env node
/**
 * Slice the canonical brand lockup `brand/Chem IRL.svg` into the three SVGs
 * that `scripts/rasterize-brand.ts` consumes:
 *
 *   - brand/logo.svg          full lockup, padded to the 727:800 aspect the
 *                             rasterizer renders it at (no distortion)
 *   - brand/logo-icon.svg     mark only, square viewBox
 *   - brand/logo-wordmark.svg wordmark only, 0 0-origin viewBox
 *
 * `Chem IRL.svg` is the single source of truth and is never written here.
 *
 * Technique: the source uses absolute root coordinates and a single global
 * `<defs>` of clip-paths. We keep the entire `<defs>` intact and include only
 * the wanted top-level `<g>` groups, wrapped in one `translate(-x0 -y0)` so the
 * crop window lands at a `0 0`-origin viewBox. Clip-paths (userSpaceOnUse) move
 * with their groups, so geometry stays aligned. The `0 0` origin matters:
 * `scripts/rasterize-brand.ts` `wrapWithSafeZone` (Android adaptive icon)
 * assumes the icon viewBox starts at `0 0`. The 9 top-level groups partition
 * cleanly: the 7 carrying `clip-path="url(#…)"` are the mark; the 2 plain
 * `<g fill="#0a7f74" fill-opacity="1">` groups are the wordmark.
 *
 * Content bounds below are in source coordinates. Mark bounds are the union of
 * the mark's axis-aligned clip rects; wordmark bounds are the true glyph ink
 * extents. A structural guard fails loudly if a re-export of `Chem IRL.svg`
 * changes the group layout, so these constants can't silently mis-slice.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const brand = (rel: string) => resolve(root, 'brand', rel);

// Source-coordinate content bounds (see header).
const MARK = { x0: 256.719, y0: 230.633, x1: 1243.031, y1: 906.383 };
const WORDMARK = { x0: 372.086, y0: 945.254, x1: 1132.262, y1: 1073.801 };
const FULL = {
  x0: Math.min(MARK.x0, WORDMARK.x0),
  y0: Math.min(MARK.y0, WORDMARK.y0),
  x1: Math.max(MARK.x1, WORDMARK.x1),
  y1: Math.max(MARK.y1, WORDMARK.y1),
};

const src = readFileSync(brand('Chem IRL.svg'), 'utf8');

const defsStart = src.indexOf('<defs>');
const defsEnd = src.indexOf('</defs>');
if (defsStart < 0 || defsEnd < 0) throw new Error('Chem IRL.svg: <defs> block not found');
const defsBlock = src.slice(defsStart, defsEnd + '</defs>'.length);
const body = src.slice(defsEnd + '</defs>'.length, src.lastIndexOf('</svg>'));

/** Split body into top-level <g>…</g> segments via a <g>/<\/g> depth counter. */
function topLevelGroups(input: string): string[] {
  const segments: string[] = [];
  const tag = /<(\/?)g\b([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(input))) {
    const isClose = m[1] === '/';
    const selfClose = m[3] === '/';
    if (isClose) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        segments.push(input.slice(start, tag.lastIndex));
        start = -1;
      }
    } else if (selfClose) {
      if (depth === 0) segments.push(input.slice(m.index, tag.lastIndex));
    } else {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return segments;
}

const groups = topLevelGroups(body);
const markGroups = groups.filter((g) => /^<g\b[^>]*clip-path=/.test(g));
const wordmarkGroups = groups.filter((g) => !/^<g\b[^>]*clip-path=/.test(g));

// Fail loudly rather than mis-slice if the source layout ever changes.
if (groups.length !== 9 || markGroups.length !== 7 || wordmarkGroups.length !== 2) {
  throw new Error(
    `Chem IRL.svg structure changed: expected 9 groups (7 mark / 2 wordmark), ` +
      `got ${groups.length} (${markGroups.length} mark / ${wordmarkGroups.length} wordmark). ` +
      `Re-derive the bound constants in scripts/split-brand-lockup.ts.`,
  );
}

const n = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Emit a `0 0 w h`-origin SVG: the selected groups are translated by
 * `(-x0, -y0)` so the crop window's top-left sits at the origin. Keeps the full
 * `<defs>`; clip-paths (userSpaceOnUse) ride along with their translated groups.
 */
function emit(
  title: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  groupsStr: string,
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${n(w)} ${n(h)}" width="${Math.round(w)}" height="${Math.round(h)}" ` +
    `preserveAspectRatio="xMidYMid meet" role="img" aria-label="Chem IRL">\n` +
    `<title>${title}</title>\n${defsBlock}\n` +
    `<g transform="translate(${n(-x0)} ${n(-y0)})">\n${groupsStr}\n</g>\n</svg>\n`
  );
}

// brand/logo.svg — full lockup, viewBox padded to 727:800 (rasterizer's fixed
// size for logo-full.png / web logo.png) so svgexport never distorts it.
const FULL_ASPECT = 727 / 800;
const lockupMargin = 80;
const lockupX0 = FULL.x0 - lockupMargin;
const lockupW = FULL.x1 - FULL.x0 + lockupMargin * 2;
const lockupH = lockupW / FULL_ASPECT;
const lockupYMid = (FULL.y0 + FULL.y1) / 2;
const lockupY0 = lockupYMid - lockupH / 2;
const logoSvg = emit('Chem IRL', lockupX0, lockupY0, lockupW, lockupH, groups.join('\n'));

// brand/logo-icon.svg — mark only, square viewBox centered on the mark.
const iconMargin = 40;
const markW = MARK.x1 - MARK.x0;
const markH = MARK.y1 - MARK.y0;
const iconSide = Math.max(markW, markH) + iconMargin * 2;
const iconMidX = (MARK.x0 + MARK.x1) / 2;
const iconMidY = (MARK.y0 + MARK.y1) / 2;
const iconSvg = emit(
  'Chem IRL',
  iconMidX - iconSide / 2,
  iconMidY - iconSide / 2,
  iconSide,
  iconSide,
  markGroups.join('\n'),
);

// brand/logo-wordmark.svg — wordmark only. Must be 0 0-origin: buildOpenGraphImage
// parses /viewBox="0 0 W H"/. Translate the groups so content starts at the pad.
const wmPad = 8;
const wmW = WORDMARK.x1 - WORDMARK.x0 + wmPad * 2;
const wmH = WORDMARK.y1 - WORDMARK.y0 + wmPad * 2;
const wordmarkSvg = emit(
  'Chem IRL wordmark',
  WORDMARK.x0 - wmPad,
  WORDMARK.y0 - wmPad,
  wmW,
  wmH,
  wordmarkGroups.join('\n'),
);

const outputs: Array<[string, string]> = [
  ['logo.svg', logoSvg],
  ['logo-icon.svg', iconSvg],
  ['logo-wordmark.svg', wordmarkSvg],
];

for (const [filename, svg] of outputs) {
  writeFileSync(brand(filename), svg, 'utf8');
  console.log(`✓ brand/${filename}  (${svg.length} bytes)`);
}

console.log(`\nDone. Sliced brand/Chem IRL.svg → ${outputs.length} consumed SVGs.`);
