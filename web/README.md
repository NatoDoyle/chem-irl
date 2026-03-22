# Chem IRL - Marketing Website

**Static marketing site for Chem IRL dating app**

This is a static Next.js site that serves as the marketing/information website. The actual dating app is a React Native mobile application (see `../mobile/`).

## Overview

The website provides:
- Landing page with value proposition
- "How it works" explanation
- App download links / waitlist
- Marketing content only (no product functionality)

## Tech Stack

- **Framework**: Next.js 16 (Static Export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (or any static hosting)

## Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── download/          # Download/waitlist page
│   │   └── how-it-works/      # How it works page
│   ├── components/            # Shared UI components
│   └── config/                # Brand tokens
├── vercel.json                # Vercel config with security headers
└── next.config.ts             # Static export config
```

## Setup Instructions

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Variables (Optional)

For build-time constants, create `.env.local`:

```env
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app
```

### 3. Development

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Build Static Site

```bash
bun run build
```

Output is in `out/` directory - deploy this to any static hosting.

## Deployment

### Vercel (Recommended)

```bash
vercel
```

Or connect GitHub repo to Vercel dashboard.

### Other Static Hosting

```bash
bun run build
# Deploy out/ directory
```

## Notes

- This is a **static site only** - no server-side code
- No API routes (removed during app-first pivot)
- All product functionality is in the mobile app (`../mobile/`)

## Related Documentation

- [Documentation Index](../docs/README.md) - Organized documentation structure
- [Mobile App README](../mobile/README.md) - Mobile app setup

## License

Private - All rights reserved.
