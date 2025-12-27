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
│   └── app/
│       ├── page.tsx           # Landing page
│       ├── download/          # Download/waitlist page
│       └── how-it-works/      # How it works page
├── db/                        # Database migrations (shared with mobile)
│   ├── schema.sql             # Database schema
│   ├── rls.sql               # RLS policies
│   ├── kpi_views.sql         # KPI views
│   └── scoring.sql           # Scoring functions
└── next.config.ts            # Static export config
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
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
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Build Static Site

```bash
npm run build
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
npm run build
# Deploy out/ directory
```

## Database Migrations

The `db/` directory contains database migrations that are shared with the mobile app. These should be run in Supabase SQL Editor (not part of website deployment).

See [`../DATABASE_SETUP.md`](../DATABASE_SETUP.md) for database setup instructions.

## Notes

- This is a **static site only** - no server-side code
- No API routes (removed during app-first pivot)
- Database migrations are for reference only (run in Supabase)
- All product functionality is in the mobile app (`../mobile/`)

## Related Documentation

- [Main Documentation](../DOCUMENTATION.md) - Complete technical docs
- [Mobile App README](../mobile/README.md) - Mobile app setup
- [Database Setup](../DATABASE_SETUP.md) - Database migrations

## Contributing

This is a solo founder project. The codebase is designed to be maintainable by one person with clear separation of concerns and comprehensive documentation.

## License

Private - All rights reserved.