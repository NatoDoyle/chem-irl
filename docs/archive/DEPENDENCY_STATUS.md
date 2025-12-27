# Dependency Installation Status

**Last Updated**: 2025-12-24

## Current Status

❌ **Dependencies NOT Installed**
- `web/node_modules/` - **MISSING**
- `mobile/node_modules/` - **MISSING**
- `package-lock.json` files exist (web ✅, mobile ✅)

## What Needs to Be Installed

### Web Dependencies (`web/package.json`)

**Production Dependencies:**
- `@supabase/supabase-js` ^2.86.2 ⚠️ **NEWLY ADDED** - needs install
- `next` ^16.0.7
- `react` ^19.2.1
- `react-dom` ^19.2.1

**Dev Dependencies:**
- `@tailwindcss/postcss` ^4
- `@types/node` ^20
- `@types/react` ^19
- `@types/react-dom` ^19
- `eslint` ^9
- `eslint-config-next` ^16.0.7
- `tailwindcss` ^4
- `typescript` ^5

### Mobile Dependencies (`mobile/package.json`)

**Production Dependencies:**
- `@react-navigation/*` (v7 packages)
- `@supabase/supabase-js` ^2.86.2
- `expo` ~54.0.27
- `expo-*` packages (image-picker, linking, secure-store, status-bar)
- `react` 19.1.0
- `react-native` 0.81.5
- `react-native-*` packages (gesture-handler, reanimated, safe-area-context, screens)
- `zod` ^4.1.13

**Dev Dependencies:**
- `@types/jest` ^29.5.14 ⚠️ **NEWLY ADDED**
- `@types/react` ~19.1.0
- `@typescript-eslint/*` ^8.0.0 ⚠️ **NEWLY ADDED**
- `eslint` ^8.57.0 ⚠️ **NEWLY ADDED**
- `eslint-config-expo` ^7.1.2 ⚠️ **NEWLY ADDED**
- `eslint-config-prettier` ^9.1.0 ⚠️ **NEWLY ADDED**
- `eslint-plugin-prettier` ^5.2.1 ⚠️ **NEWLY ADDED**
- `jest` ^29.7.0 ⚠️ **NEWLY ADDED**
- `jest-expo` ~52.0.0 ⚠️ **NEWLY ADDED**
- `prettier` ^3.4.2 ⚠️ **NEWLY ADDED**
- `react-test-renderer` 19.1.0 ⚠️ **NEWLY ADDED**
- `typescript` ~5.9.2

## Installation Instructions

**Prerequisites:** Node.js 18+ and npm must be installed on your system.

### Install Web Dependencies

```bash
cd web
npm install
```

**Expected output:** Creates `web/node_modules/` with all packages from `package.json`

### Install Mobile Dependencies

```bash
cd mobile
npm install
```

**Expected output:** Creates `mobile/node_modules/` with all packages from `package.json`

### Verify Installation

**Check web:**
```bash
cd web
npm list @supabase/supabase-js next react 2>/dev/null
```

**Check mobile:**
```bash
cd mobile
npm list jest eslint prettier expo 2>/dev/null
```

## Recent Changes Requiring Installation

### Web (Added 2025-12-24)
- `@supabase/supabase-js` - Added for placeholder Supabase client files

### Mobile (Added 2025-12-24)
- Testing: `jest`, `jest-expo`, `@types/jest`, `react-test-renderer`
- Linting: `eslint`, `eslint-config-expo`, `eslint-config-prettier`, `eslint-plugin-prettier`
- Formatting: `prettier`
- TypeScript: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`

## Build/Test Commands (After Installation)

**Web:**
```bash
cd web
npm run build      # Build static site
npm run dev        # Start dev server
npm run lint       # Lint code
npm run type-check # TypeScript check
```

**Mobile:**
```bash
cd mobile
npm start          # Start Expo dev server
npm test           # Run Jest tests
npm run lint       # Lint code
npm run format     # Format code
npm run type-check # TypeScript check
```

## Troubleshooting

**If `npm install` fails:**
1. Ensure Node.js 18+ is installed: `node --version`
2. Clear npm cache: `npm cache clean --force`
3. Delete `package-lock.json` and try again (will regenerate)
4. Check internet connection (npm needs to download packages)

**If specific packages fail:**
- Check package versions are compatible with Node.js version
- Try installing packages individually to identify the problem package
- Check for peer dependency warnings

