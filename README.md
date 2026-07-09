# Chem IRL - Dating App

**App-first dating platform that optimizes time-to-date**

[![Status](https://img.shields.io/badge/status-beta%20build--out-blue)]()
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue)]()
[![Stack](https://img.shields.io/badge/stack-React%20Native%20%7C%20Supabase-orange)]()

## Quick Start

### Mobile App

```bash
cd mobile
bun install
# Create .env file with Supabase credentials (see mobile/.env.example)
bun start
```

### Website

```bash
cd web
bun install
bun run build
```

## What is Chem IRL?

Chem IRL is a dating app designed to get people meeting face-to-face faster by eliminating endless texting. The core mechanic requires users to propose exactly 2-3 specific times within 7 days, with proposals expiring after 72 hours.

### Key Features

- **OTP Code Authentication** - Passwordless email OTP login
- **Discovery Feed** - Swipe-based matching with scoring
- **Structured Proposals** - 2-3 time windows within 7 days
- **72-Hour Expiry** - Proposals expire automatically
- **Real-time Chat** - Unlocked after confirmation
- **Scoring System** - Action Speed, Profile Quality, Reliability

## Architecture

- **Mobile App**: React Native (Expo SDK 54) with direct Supabase connection
- **Website**: Static Next.js site (marketing only)
- **Backend**: Supabase (Postgres + Auth + RLS + Realtime + Storage + Edge Functions)

## Documentation

- **[Documentation Index](./docs/README.md)** - Organized documentation structure
- **[Mobile App README](./mobile/README.md)** - Mobile app setup and development
- **[Website README](./web/README.md)** - Website setup
- **[Agent Docs](./agent_docs/)** - AI agent task-specific instructions

## Project Structure

```
chem-irl/
├── mobile/          # React Native app (primary product)
├── web/             # Static marketing site (Vercel)
├── supabase/        # Migrations (source of truth), edge functions, config
├── db/              # Reference SQL files (schema, RLS, RPCs, scoring)
├── docs/            # Product, architecture, and implementation docs
├── agent_docs/      # Task-specific agent instructions
└── scripts/         # Root-level utility scripts
```

## Tech Stack

**Mobile**
- React Native (Expo SDK 54)
- TypeScript
- React Navigation v7
- Supabase Client

**Website**
- Next.js 16 (Static Export)
- TypeScript
- Tailwind CSS

**Backend**
- Supabase (PostgreSQL + Auth + RLS + Realtime + Storage)
- Edge Functions (push, IAP validation, Iris AI concierge, photo moderation, waitlist + support)
- pg_cron (scheduled scoring)

## Quality Gates

```bash
# Mobile (run from mobile/)
bun run lint -- --max-warnings 0   # ESLint
bun run type-check                 # TypeScript strict
bun run test:unit                  # Unit tests
bun run format:check               # Prettier

# Documentation links
bun run docs:check
```

## Deployment

### Mobile App
- Build with EAS Build
- Submit to App Store / Play Store

### Website
- Deploy to Vercel (static export)

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for the development workflow — worktree-first git, quality gates, and where the docs live. [CLAUDE.md](./CLAUDE.md) is the detailed source of truth.

## License

Private - All rights reserved

---

**Status**: Beta build-out — Dublin launch prep
**Last Updated**: 2026-07-09
