#!/usr/bin/env node
// Regenerates per-app brand files from brand/tokens.ts.
//
// Outputs:
//   - mobile/src/config/brand.ts
//   - web/src/config/brand.ts
//   - web/src/app/globals.css (only the @theme block between BRAND-TOKENS markers)
//
// Usage:
//   bunx tsx scripts/generate-brand-tokens.ts           # write
//   bunx tsx scripts/generate-brand-tokens.ts --check   # diff against on-disk; exit 1 on drift

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRAND,
  EXTENDED_RADIUS,
  MESSAGES_TOKENS,
  MIDNIGHT_TOKENS,
  MOBILE_ANIMATION,
  MOBILE_GRADIENTS,
  MOBILE_PALETTE,
  MOBILE_SHADOWS,
  PALETTE,
  SEMANTIC,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  WEB_COMMUNITY_TOKENS,
  WEB_CSS_THEME,
  WEB_GRADIENTS,
  WEB_PALETTE,
  type MobileShadowSpec,
} from '../brand/tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// ============================================================================
// String emission helpers
// ============================================================================

/** Single-quote when possible; double-quote if string contains a single quote. */
function q(s: string): string {
  if (!s.includes("'")) return `'${s.replace(/\\/g, '\\\\')}'`;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Numeric-looking key emits unquoted, identifier emits unquoted, else quoted. */
function key(k: string): string {
  if (/^\d+$/.test(k)) return k;
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)) return k;
  return q(k);
}

/** Serialize a JS value as TS source. Plain data only — no functions / classes. */
function val(v: unknown, indent: number): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return q(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const items = v.map((x) => val(x, indent + 1));
    return `[${items.join(', ')}]`;
  }
  if (typeof v === 'object') {
    const pad = '  '.repeat(indent);
    const inner = '  '.repeat(indent + 1);
    const entries = Object.entries(v).map(
      ([k, x]) => `${inner}${key(k)}: ${val(x, indent + 1)},`,
    );
    return `{\n${entries.join('\n')}\n${pad}}`;
  }
  throw new Error(`Cannot serialize: ${typeof v}`);
}

/** Mobile shadow → Platform.select({ ios: { ... }, android: { elevation } }). */
function mobileShadow(spec: MobileShadowSpec, indent: number): string {
  const inner = '  '.repeat(indent + 1);
  const inner2 = '  '.repeat(indent + 2);
  const pad = '  '.repeat(indent);
  return [
    'Platform.select({',
    `${inner}ios: {`,
    `${inner2}shadowColor: ${q(spec.color)},`,
    `${inner2}shadowOffset: { width: 0, height: ${spec.offsetY} },`,
    `${inner2}shadowOpacity: ${spec.opacity},`,
    `${inner2}shadowRadius: ${spec.radius},`,
    `${inner}},`,
    `${inner}android: { elevation: ${spec.androidElevation} },`,
    `${pad}})`,
  ].join('\n');
}

// ============================================================================
// Mobile emission
// ============================================================================

const GENERATED_BANNER = [
  '// GENERATED — do not edit; run `bun run brand:tokens` to update.',
  '// Canonical source: brand/tokens.ts',
].join('\n');

function emitMobile(): string {
  const shadowEntry = (name: string, spec: MobileShadowSpec, depth: number) =>
    `${'  '.repeat(depth)}${name}: ${mobileShadow(spec, depth)},`;

  const brandColors = {
    aqua: PALETTE.aqua,
    primary: MOBILE_PALETTE.primary,
    primaryPressed: MOBILE_PALETTE.primaryPressed,
    primarySoft: MOBILE_PALETTE.primarySoft,
    primaryLight: MOBILE_PALETTE.primaryLight,
    primaryHover: MOBILE_PALETTE.primaryHover,
    surface: MOBILE_PALETTE.surface,
    border: MOBILE_PALETTE.border,
    text: MOBILE_PALETTE.text,
    success: SEMANTIC.success,
    warning: SEMANTIC.warning,
    danger: SEMANTIC.danger,
    info: SEMANTIC.info,
    background: MOBILE_PALETTE.background,
    onPrimary: MOBILE_PALETTE.onPrimary,
  };

  const midnightBase = {
    bg: MIDNIGHT_TOKENS.bg,
    surface: MIDNIGHT_TOKENS.surface,
    inputBg: MIDNIGHT_TOKENS.inputBg,
    borderDefault: MIDNIGHT_TOKENS.borderDefault,
    coral: MIDNIGHT_TOKENS.coral,
    radius: MIDNIGHT_TOKENS.radius,
    glassCard: MIDNIGHT_TOKENS.glassCard,
    glassCardSm: MIDNIGHT_TOKENS.glassCardSm,
  };

  const lines: string[] = [
    GENERATED_BANNER,
    '',
    "import { Platform } from 'react-native';",
    '',
    `export const BRAND = ${val(BRAND, 0)} as const;`,
    '',
    `export const BRAND_COLORS = ${val(brandColors, 0)} as const;`,
    '',
    '// --- Midnight Chemistry Design System ---',
    '// Dark premium aesthetic. Deep midnight backgrounds, glass cards,',
    '// aquamarine glow effects, and gold CTAs.',
    '',
    'export const MIDNIGHT = {',
    `  bg: ${q(midnightBase.bg)},`,
    `  surface: ${q(midnightBase.surface)},`,
    `  inputBg: ${q(midnightBase.inputBg)},`,
    `  borderDefault: ${q(midnightBase.borderDefault)},`,
    `  coral: ${q(midnightBase.coral)},`,
    `  radius: ${val(midnightBase.radius, 1)},`,
    '  shadow: {',
    shadowEntry('warm', MOBILE_SHADOWS.warm, 2),
    shadowEntry('warmLg', MOBILE_SHADOWS.warmLg, 2),
    '  },',
    `  glassCard: ${val(midnightBase.glassCard, 1)},`,
    `  glassCardSm: ${val(midnightBase.glassCardSm, 1)},`,
    '  glow: {',
    shadowEntry('primary', MOBILE_SHADOWS.glowPrimary, 2),
    shadowEntry('gold', MOBILE_SHADOWS.glowGold, 2),
    shadowEntry('selected', MOBILE_SHADOWS.glowSelected, 2),
    '  },',
    '} as const;',
    '',
    '// Backward-compat alias — all files importing GOLDEN_HOUR resolve to MIDNIGHT.',
    'export const GOLDEN_HOUR = MIDNIGHT;',
    '',
    `export const GOLD = ${val(PALETTE.gold, 0)} as const;`,
    '',
    'export const TYPOGRAPHY = {',
    `  fontFamily: ${val(TYPOGRAPHY_TOKENS.mobileFontFamily, 1)},`,
    `  fontSize: ${val(TYPOGRAPHY_TOKENS.fontSize, 1)},`,
    `  lineHeight: ${val(TYPOGRAPHY_TOKENS.lineHeight, 1)},`,
    `  letterSpacing: ${val(TYPOGRAPHY_TOKENS.letterSpacing, 1)},`,
    '} as const;',
    '',
    `export const SPACING = ${val(SPACING_TOKENS, 0)} as const;`,
    '',
    'export const REFINED_WARMTH = {',
    '  ...MIDNIGHT,',
    `  gold: GOLD[${600}],`,
    `  goldSoft: GOLD[${100}],`,
    '  gradient: {',
    ...Object.entries(MOBILE_GRADIENTS).map(
      ([name, tuple]) => `    ${key(name)}: ${val(tuple, 2)} as const,`,
    ),
    '  },',
    `  radius: { ...MIDNIGHT.radius, xl: ${EXTENDED_RADIUS.xl} },`,
    '  shadow: {',
    '    ...MIDNIGHT.shadow,',
    shadowEntry('subtle', MOBILE_SHADOWS.subtle, 2),
    shadowEntry('elevated', MOBILE_SHADOWS.elevated, 2),
    '  },',
    `  animation: ${val(MOBILE_ANIMATION, 1)},`,
    '  typography: TYPOGRAPHY,',
    '  spacing: SPACING,',
    '} as const;',
    '',
    `export const BRAND_MESSAGES = ${val(MESSAGES_TOKENS, 0)} as const;`,
    '',
  ];

  return lines.join('\n');
}

// ============================================================================
// Web emission
// ============================================================================

function emitWeb(): string {
  const brandColors = {
    aqua: PALETTE.aqua,
    primary: WEB_PALETTE.primary,
    primaryPressed: WEB_PALETTE.primaryPressed,
    primarySoft: WEB_PALETTE.primarySoft,
    primaryHover: WEB_PALETTE.primaryHover,
    surface: WEB_PALETTE.surface,
    border: WEB_PALETTE.border,
    text: WEB_PALETTE.text,
    success: SEMANTIC.success,
    warning: SEMANTIC.warning,
    danger: SEMANTIC.danger,
    info: SEMANTIC.info,
    background: WEB_PALETTE.background,
    onPrimary: WEB_PALETTE.onPrimary,
    accentWarm: WEB_PALETTE.accentWarm,
    backgroundWarm: WEB_PALETTE.backgroundWarm,
    gold: PALETTE.gold,
    goldAccent: WEB_PALETTE.goldAccent,
  };

  const lines: string[] = [
    GENERATED_BANNER,
    '',
    `export const BRAND = ${val(BRAND, 0)} as const;`,
    '',
    `export const BRAND_COLORS = ${val(brandColors, 0)} as const;`,
    '',
    `export const BRAND_GRADIENTS = ${val(WEB_GRADIENTS, 0)} as const;`,
    '',
    `export const BRAND_MESSAGES = ${val(MESSAGES_TOKENS, 0)} as const;`,
    '',
    '// Community channels surfaced on the /support page. discordUrl is read',
    `// from ${WEB_COMMUNITY_TOKENS.discordUrlEnvVar} (exposed via web/next.config.ts).`,
    '// When unset, the support page hides the Community card and shows only',
    '// the email contact.',
    'export const COMMUNITY = {',
    `  discordUrl: process.env.${WEB_COMMUNITY_TOKENS.discordUrlEnvVar} ?? '',`,
    `  supportEmail: ${q(WEB_COMMUNITY_TOKENS.supportEmail)},`,
    '} as const;',
    '',
  ];

  return lines.join('\n');
}

// ============================================================================
// Web globals.css @theme block
// ============================================================================

const CSS_START = '/* BRAND-TOKENS:START — generated by `bun run brand:tokens` */';
const CSS_END = '/* BRAND-TOKENS:END */';

function emitGlobalsCssBlock(): string {
  const cssVar = (name: string, value: string | number) => `  ${name}: ${value};`;
  const aquaLines = Object.entries(PALETTE.aqua).map(([k, v]) =>
    cssVar(`--color-aqua-${k}`, v),
  );
  const goldLines = Object.entries(PALETTE.gold).map(([k, v]) =>
    cssVar(`--color-gold-${k}`, v),
  );
  const inkLines = Object.entries(PALETTE.ink).map(([k, v]) =>
    cssVar(`--color-ink-${k}`, v),
  );

  return [
    CSS_START,
    '@theme inline {',
    cssVar('--color-background', 'var(--background)'),
    cssVar('--color-foreground', 'var(--foreground)'),
    '',
    '  /* Aquamarine scale */',
    ...aquaLines,
    '',
    '  /* Warm accent */',
    cssVar('--color-coral', PALETTE.coral),
    '',
    '  /* Ink scale */',
    ...inkLines,
    '',
    '  /* Semantic */',
    cssVar('--color-warm-bg', WEB_CSS_THEME.warmBg),
    cssVar('--color-dark-bg', WEB_CSS_THEME.darkBg),
    cssVar('--color-surface', WEB_CSS_THEME.surface),
    '',
    '  /* Gold scale */',
    ...goldLines,
    '',
    '  /* Fonts */',
    cssVar('--font-sans', TYPOGRAPHY_TOKENS.webFontVars.sans),
    cssVar('--font-serif', TYPOGRAPHY_TOKENS.webFontVars.serif),
    '',
    '  /* Shadows */',
    cssVar('--shadow-warm', WEB_CSS_THEME.shadows.warm),
    cssVar('--shadow-warm-lg', WEB_CSS_THEME.shadows.warmLg),
    cssVar('--shadow-nav', WEB_CSS_THEME.shadows.nav),
    cssVar('--shadow-subtle', WEB_CSS_THEME.shadows.subtle),
    cssVar('--shadow-elevated', WEB_CSS_THEME.shadows.elevated),
    '',
    '  /* Brand radius */',
    cssVar('--radius-brand', `${WEB_CSS_THEME.radiusBrand}px`),
    '}',
    CSS_END,
  ].join('\n');
}

function replaceCssBlock(existing: string, replacement: string): string {
  const startIdx = existing.indexOf(CSS_START);
  const endIdx = existing.indexOf(CSS_END);

  if (startIdx === -1 || endIdx === -1) {
    // Markers not present yet — find the legacy @theme block and replace it.
    const themeStart = existing.indexOf('@theme');
    if (themeStart === -1) {
      throw new Error(
        `Cannot place BRAND-TOKENS block: neither markers nor @theme found in globals.css`,
      );
    }
    // Find matching closing brace for @theme block.
    let depth = 0;
    let i = existing.indexOf('{', themeStart);
    if (i === -1) throw new Error('Malformed @theme block in globals.css');
    for (; i < existing.length; i++) {
      if (existing[i] === '{') depth++;
      else if (existing[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const beforeBlock = existing.slice(0, themeStart);
    const afterBlock = existing.slice(i + 1);
    return `${beforeBlock.replace(/\s+$/, '')}\n\n${replacement}\n${afterBlock.replace(/^\s+/, '\n')}`;
  }

  // Markers present — replace between them.
  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + CSS_END.length);
  return `${before}${replacement}${after}`;
}

// ============================================================================
// Driver
// ============================================================================

type Output = { path: string; content: string };

function computeOutputs(): Output[] {
  const mobilePath = resolve(repoRoot, 'mobile/src/config/brand.ts');
  const webPath = resolve(repoRoot, 'web/src/config/brand.ts');
  const cssPath = resolve(repoRoot, 'web/src/app/globals.css');

  const existingCss = readFileSync(cssPath, 'utf-8');
  const newCss = replaceCssBlock(existingCss, emitGlobalsCssBlock());

  return [
    { path: mobilePath, content: emitMobile() },
    { path: webPath, content: emitWeb() },
    { path: cssPath, content: newCss },
  ];
}

function main() {
  const check = process.argv.includes('--check');
  const outputs = computeOutputs();

  if (check) {
    const drifts: string[] = [];
    for (const { path, content } of outputs) {
      const existing = readFileSync(path, 'utf-8');
      if (existing !== content) {
        drifts.push(path);
      }
    }
    if (drifts.length > 0) {
      console.error('Brand token drift detected:');
      for (const p of drifts) console.error(`  - ${p}`);
      console.error("\nRun 'bun run brand:tokens' to regenerate.");
      process.exit(1);
    }
    console.log('Brand tokens are in sync.');
    return;
  }

  for (const { path, content } of outputs) {
    writeFileSync(path, content, 'utf-8');
    console.log(`Wrote ${path}`);
  }
}

main();
