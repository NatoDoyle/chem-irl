#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const brand = (rel: string) => resolve(root, 'brand', rel);
const scratch = resolve(root, 'brand/working/raster-scratch');

// Colors sourced from mobile/src/config/brand.ts.
const BG_SPLASH_WARM = '#F7FFFE';
const BG_WHITE = '#FFFFFF';
const BG_AQUA = '#0A7F74';
const INK = '#0B1220';

mkdirSync(scratch, { recursive: true });

async function svgexport(src: string, dst: string, size: string): Promise<void> {
  mkdirSync(dirname(dst), { recursive: true });
  await run('bunx', ['--bun', 'svgexport', src, dst, size], {
    cwd: root,
    maxBuffer: 1024 * 1024 * 16,
  });
}

function wrapWithBackground(svgPath: string, bgColor: string): string {
  const svg = readFileSync(svgPath, 'utf8');
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) throw new Error(`No viewBox in ${svgPath}`);
  const [, viewBox] = viewBoxMatch;
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
  return svg.replace(
    /<svg([^>]*)>/,
    `<svg$1>\n  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}"/>`,
  );
}

/**
 * Wrap a square icon SVG into a larger square canvas with the icon scaled to
 * occupy `fractionOfCanvas` of the total canvas (remainder is transparent).
 * Used for Android adaptive-icon foreground — the outer region is masked by
 * the launcher's shape so the mark must stay within the inner safe zone.
 */
function wrapWithSafeZone(svgPath: string, fractionOfCanvas: number, canvas: number): string {
  const inner = readFileSync(svgPath, 'utf8');
  const viewBoxMatch = inner.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) throw new Error(`No viewBox in ${svgPath}`);
  const [, viewBox] = viewBoxMatch;
  const [, , iw, ih] = viewBox.split(/\s+/).map(Number);
  const iconSide = Math.max(iw, ih);
  const actualScale = (fractionOfCanvas * canvas) / iconSide;
  const renderedW = iw * actualScale;
  const renderedH = ih * actualScale;
  const offsetX = (canvas - renderedW) / 2;
  const offsetY = (canvas - renderedH) / 2;
  const innerContent = inner
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/<svg[^>]*>\s*/, '')
    .replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}">
  <g transform="translate(${offsetX} ${offsetY}) scale(${actualScale})">
    ${innerContent}
  </g>
</svg>
`;
}

type Target = {
  label: string;
  src: string;
  dst: string;
  size: string;
  /** Background color to flatten onto. iOS icons reject alpha. */
  opaqueBg?: string;
  /** Android adaptive: scale mark to inner region; outer remains transparent. */
  adaptiveScale?: number;
};

const targets: Target[] = [
  {
    label: 'mobile/assets/logo-full.png',
    src: brand('logo.svg'),
    dst: resolve(root, 'mobile/assets/logo-full.png'),
    size: '727:800',
  },
  {
    label: 'mobile/assets/icon.png (iOS opaque)',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'mobile/assets/icon.png'),
    size: '1024:1024',
    opaqueBg: BG_SPLASH_WARM,
  },
  {
    label: 'mobile/assets/adaptive-icon.png (Android safe zone)',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'mobile/assets/adaptive-icon.png'),
    size: '1024:1024',
    adaptiveScale: 0.88,
  },
  {
    label: 'mobile/assets/splash-icon.png',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'mobile/assets/splash-icon.png'),
    size: '1024:1024',
  },
  {
    label: 'mobile/assets/favicon.png',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'mobile/assets/favicon.png'),
    size: '48:48',
  },
  {
    label: 'web/public/logo.png',
    src: brand('logo.svg'),
    dst: resolve(root, 'web/public/logo.png'),
    size: '200:220',
  },
  {
    label: 'web/public/logo-icon.png',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'web/public/logo-icon.png'),
    size: '64:64',
  },
  {
    label: 'web/src/app/icon.png',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'web/src/app/icon.png'),
    size: '512:512',
  },
  {
    label: 'web/src/app/apple-icon.png (iOS opaque)',
    src: brand('logo-icon.svg'),
    dst: resolve(root, 'web/src/app/apple-icon.png'),
    size: '180:180',
    opaqueBg: BG_WHITE,
  },
];

async function stripAlpha(pngPath: string, bgColor: string): Promise<void> {
  // Re-encode the PNG as RGB (no alpha channel) flattened onto bgColor.
  // iOS App Store validator rejects icons with an alpha channel even when
  // all pixel alpha values are 255.
  const buf = await sharp(pngPath)
    .flatten({ background: bgColor })
    .png({ compressionLevel: 9, palette: false })
    .removeAlpha()
    .toBuffer();
  writeFileSync(pngPath, buf);
}

async function rasterize(t: Target): Promise<void> {
  let workingSrc = t.src;
  if (t.adaptiveScale) {
    const wrapped = wrapWithSafeZone(t.src, t.adaptiveScale, 1024);
    workingSrc = resolve(scratch, `adaptive-${Date.now()}.svg`);
    writeFileSync(workingSrc, wrapped, 'utf8');
  } else if (t.opaqueBg) {
    const wrapped = wrapWithBackground(t.src, t.opaqueBg);
    workingSrc = resolve(scratch, `opaque-${Date.now()}.svg`);
    writeFileSync(workingSrc, wrapped, 'utf8');
  }
  await svgexport(workingSrc, t.dst, t.size);
  if (workingSrc !== t.src) unlinkSync(workingSrc);
  if (t.opaqueBg) await stripAlpha(t.dst, t.opaqueBg);
  console.log(`✓ ${t.label}`);
}

async function buildFaviconIco(): Promise<void> {
  const sizes = [16, 32, 48];
  const pngPaths: string[] = [];
  for (const s of sizes) {
    const out = resolve(scratch, `favicon-${s}.png`);
    await svgexport(brand('logo-icon.svg'), out, `${s}:${s}`);
    pngPaths.push(out);
  }
  const icoBuf = await pngToIco(pngPaths);
  const dst = resolve(root, 'web/src/app/favicon.ico');
  writeFileSync(dst, icoBuf);
  for (const p of pngPaths) unlinkSync(p);
  console.log(`✓ web/src/app/favicon.ico (${sizes.join(', ')}px multi-res)`);
}

async function buildOpenGraphImage(): Promise<void> {
  // 1200×630 social card: aquamarine gradient, icon left, wordmark + tagline right.
  const tagline = 'Less texting. More chemistry.';
  const iconRawSvg = readFileSync(brand('logo-icon.svg'), 'utf8');
  const iconVb = iconRawSvg.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/);
  if (!iconVb) throw new Error('logo-icon.svg viewBox missing');
  const ivx = Number(iconVb[1]);
  const ivy = Number(iconVb[2]);
  const ivh = Number(iconVb[4]);
  // Icon viewBox is not 0 0-origin; compute a transform that lands it on the
  // card. The single-color aqua mark is invisible on the dark aqua gradient, so
  // knock its aqua fills/strokes white; recolor the heart knockout to aqua so it
  // stays visible against the now-white vesica (inverts the light-bg treatment).
  const iconScale = 360 / ivh;
  const iconSvgRaw = iconRawSvg
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(
      /<svg[^>]*>\s*/,
      `<g transform="translate(${(110 - ivx * iconScale).toFixed(2)} ${(135 - ivy * iconScale).toFixed(2)}) scale(${iconScale.toFixed(5)})">`,
    )
    .replace(/<\/svg>\s*$/, '</g>')
    .replace(/fill="#ffffff"/g, 'fill="#0A7F74"')
    .replace(/fill="#0a7f74"/g, 'fill="#FFFFFF"')
    .replace(/stroke="#0a7f74"/g, 'stroke="#FFFFFF"');
  const wordmarkSvg = readFileSync(brand('logo-wordmark.svg'), 'utf8');
  const wmViewBox = wordmarkSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!wmViewBox) throw new Error('wordmark viewBox missing');
  const wmW = Number(wmViewBox[1]);
  const wmH = Number(wmViewBox[2]);
  // New wordmark is single-color aqua (#0a7f74). Render it all white on the
  // dark card for legibility (README: mono-white on dark/aqua backgrounds).
  const wordmarkInline = wordmarkSvg
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/fill="#0a7f74"/gi, 'fill="#FFFFFF"');
  // Scale wordmark so the whole lockup fits horizontally on the 1200 canvas.
  // Wordmark native width ~776; at scale 0.72 ≈ 559px. Place at x=530 to leave margin.
  const wmScale = 0.72;
  const wmX = 530;
  const wmY = 210;
  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0A7F74"/>
      <stop offset="60%" stop-color="#086E64"/>
      <stop offset="100%" stop-color="#064C46"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
  ${iconSvgRaw}
  <g transform="translate(${wmX} ${wmY}) scale(${wmScale})">
    <svg xmlns="http://www.w3.org/2000/svg" width="${wmW}" height="${wmH}" viewBox="0 0 ${wmW} ${wmH}">
      ${wordmarkInline.replace(/<svg[^>]*>\s*/, '').replace(/<\/svg>\s*$/, '')}
    </svg>
  </g>
  <text x="${wmX}" y="400" fill="#FFFFFF" font-family="Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="42" font-weight="600" opacity="0.95">${tagline}</text>
  <text x="${wmX}" y="470" fill="#FFFFFF" font-family="Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="500" opacity="0.7">chemirl.app</text>
</svg>
`;
  const ogSrc = resolve(scratch, 'og-composed.svg');
  writeFileSync(ogSrc, og, 'utf8');
  await svgexport(ogSrc, resolve(root, 'web/src/app/opengraph-image.png'), '1200:630');
  console.log('✓ web/src/app/opengraph-image.png');
}

(async () => {
  for (const t of targets) await rasterize(t);
  await buildFaviconIco();
  await buildOpenGraphImage();
  console.log(`\nDone. All platform assets regenerated.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
