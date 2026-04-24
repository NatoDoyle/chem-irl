#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const brandDir = resolve(root, 'brand');

const COLOR = {
  aqua: '#0A7F74',
  gold: '#CA8A04',
  coral: '#F97316',
  ink: '#0B1220',
  white: '#FFFFFF',
} as const;

const FLASK_PATH =
  'M 98 36 Q 98 30 104 30 L 152 30 Q 158 30 158 36 L 158 46 Q 158 50 154 50 L 150 50 L 150 92 L 204 196 Q 212 212 196 212 L 60 212 Q 44 212 52 196 L 106 92 L 106 50 L 102 50 Q 98 50 98 46 Z';

const HEART_PATH =
  'M 128 176 C 128 176 100 156 100 136 C 100 126 108 118 118 118 C 123 118 127 121 128 124 C 129 121 133 118 138 118 C 148 118 156 126 156 136 C 156 156 128 176 128 176 Z';

const ICON_VIEWBOX = 256;

const font = opentype.loadSync(resolve(brandDir, 'fonts/Inter-ExtraBold.ttf'));

type WordmarkPaths = {
  chem: string;
  irl: string;
  chemWidth: number;
  irlWidth: number;
  height: number;
  baselineOffset: number;
};

function buildWordmarkPaths(fontSize: number): WordmarkPaths {
  const chemPath = font.getPath('Chem', 0, 0, fontSize);
  const irlPath = font.getPath('IRL', 0, 0, fontSize);
  const chemBbox = chemPath.getBoundingBox();
  const irlBbox = irlPath.getBoundingBox();
  const height = Math.ceil(Math.max(chemBbox.y2 - chemBbox.y1, irlBbox.y2 - irlBbox.y1));
  const baselineOffset = Math.ceil(-chemBbox.y1);
  return {
    chem: chemPath.toPathData(3),
    irl: irlPath.toPathData(3),
    chemWidth: font.getAdvanceWidth('Chem', fontSize),
    irlWidth: font.getAdvanceWidth('IRL', fontSize),
    height,
    baselineOffset,
  };
}

function iconGroup(flask: string, heart: string, translateX = 0, translateY = 0, scale = 1): string {
  const transform = `translate(${translateX} ${translateY})${scale !== 1 ? ` scale(${scale})` : ''}`;
  return (
    `  <g transform="${transform}">\n` +
    `    <path d="${FLASK_PATH}" fill="${flask}"/>\n` +
    `    <path d="${HEART_PATH}" fill="${heart}"/>\n` +
    `  </g>\n`
  );
}

function buildIconSVG(flaskColor: string, heartColor: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}" role="img" aria-label="Chem IRL">\n` +
    `  <title>Chem IRL</title>\n` +
    `  <path d="${FLASK_PATH}" fill="${flaskColor}"/>\n` +
    `  <path d="${HEART_PATH}" fill="${heartColor}"/>\n` +
    `</svg>\n`
  );
}

function buildWordmarkSVG(chemColor: string, irlColor: string): string {
  const fontSize = 96;
  const gap = 24;
  const paddingX = 8;
  const paddingY = 12;
  const wm = buildWordmarkPaths(fontSize);
  const totalWidth = Math.ceil(wm.chemWidth + gap + wm.irlWidth) + paddingX * 2;
  const canvasHeight = wm.height + paddingY * 2;
  const baselineY = paddingY + wm.baselineOffset;
  const chemX = paddingX;
  const irlX = paddingX + wm.chemWidth + gap;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${canvasHeight}" role="img" aria-label="Chem IRL">\n` +
    `  <title>Chem IRL wordmark</title>\n` +
    `  <g transform="translate(${chemX} ${baselineY})"><path d="${wm.chem}" fill="${chemColor}"/></g>\n` +
    `  <g transform="translate(${irlX} ${baselineY})"><path d="${wm.irl}" fill="${irlColor}"/></g>\n` +
    `</svg>\n`
  );
}

function buildLockupSVG(opts: {
  flask: string;
  heart: string;
  chem: string;
  irl: string;
}): string {
  // Canvas 364 × 400 (9:10 aspect, matches existing logo-full.png 727×800).
  const canvasW = 364;
  const canvasH = 400;
  const iconSize = 216;
  const iconX = (canvasW - iconSize) / 2;
  const iconY = 28;
  const iconScale = iconSize / ICON_VIEWBOX;
  const wordmarkFontSize = 72;
  const gap = 18;
  const wm = buildWordmarkPaths(wordmarkFontSize);
  const wordmarkTotalWidth = wm.chemWidth + gap + wm.irlWidth;
  const chemX = (canvasW - wordmarkTotalWidth) / 2;
  const irlX = chemX + wm.chemWidth + gap;
  const iconBottomY = iconY + iconSize;
  const wordmarkTopY = iconBottomY + 32;
  const baselineY = wordmarkTopY + wm.baselineOffset;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${canvasH}" role="img" aria-label="Chem IRL">\n` +
    `  <title>Chem IRL</title>\n` +
    iconGroup(opts.flask, opts.heart, iconX, iconY, iconScale) +
    `  <g transform="translate(${chemX.toFixed(2)} ${baselineY.toFixed(2)})"><path d="${wm.chem}" fill="${opts.chem}"/></g>\n` +
    `  <g transform="translate(${irlX.toFixed(2)} ${baselineY.toFixed(2)})"><path d="${wm.irl}" fill="${opts.irl}"/></g>\n` +
    `</svg>\n`
  );
}

mkdirSync(brandDir, { recursive: true });

const variants: Array<[string, string]> = [
  ['logo.svg', buildLockupSVG({ flask: COLOR.aqua, heart: COLOR.gold, chem: COLOR.ink, irl: COLOR.aqua })],
  ['logo-icon.svg', buildIconSVG(COLOR.aqua, COLOR.gold)],
  ['logo-wordmark.svg', buildWordmarkSVG(COLOR.ink, COLOR.aqua)],
  ['logo-mono-black.svg', buildLockupSVG({ flask: COLOR.ink, heart: COLOR.ink, chem: COLOR.ink, irl: COLOR.ink })],
  ['logo-mono-white.svg', buildLockupSVG({ flask: COLOR.white, heart: COLOR.white, chem: COLOR.white, irl: COLOR.white })],
  ['logo-aqua.svg', buildLockupSVG({ flask: COLOR.aqua, heart: COLOR.aqua, chem: COLOR.aqua, irl: COLOR.aqua })],
  ['logo-gold.svg', buildLockupSVG({ flask: COLOR.gold, heart: COLOR.gold, chem: COLOR.gold, irl: COLOR.gold })],
];

for (const [filename, svg] of variants) {
  const path = resolve(brandDir, filename);
  writeFileSync(path, svg, 'utf8');
  console.log(`✓ ${filename}  (${svg.length} bytes)`);
}

console.log(`\nDone. Emitted ${variants.length} SVG variants to ${brandDir}`);
