# Chem IRL - Dating App

**App-first dating platform that optimizes time-to-date**

[![Status](https://img.shields.io/badge/status-MVP-green)]()
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue)]()
[![Stack](https://img.shields.io/badge/stack-React%20Native%20%7C%20Supabase-orange)]()

## 🚀 Quick Start

### Mobile App
```bash
cd mobile
npm install
# Create .env file with Supabase credentials
npm start
```

### Website
```bash
cd web
npm install
npm run build
```

## 📱 What is Chem IRL?

Chem IRL is a dating app designed to get people meeting face-to-face faster by eliminating endless texting. The core mechanic requires users to propose exactly 2-3 specific times within 7 days, with proposals expiring after 72 hours.

### Key Features

- ✅ **Magic Link Authentication** - Passwordless login
- ✅ **Discovery Feed** - Swipe-based matching with scoring
- ✅ **Structured Proposals** - 2-3 time windows within 7 days
- ✅ **72-Hour Expiry** - Proposals expire automatically
- ✅ **Real-time Chat** - Unlocked after confirmation
- ✅ **Scoring System** - Action Speed, Profile Quality, Reliability

## 🏗️ Architecture

- **Mobile App**: React Native (Expo) → Direct Supabase connection
- **Website**: Static Next.js site (marketing only)
- **Backend**: Supabase (Postgres + Auth + RLS + Realtime + Storage)
- **Payments**: Stripe
- **Email**: Postmark

See [ARCHITECTURE_PIVOT_PLAN.md](./ARCHITECTURE_PIVOT_PLAN.md) for detailed architecture.

## 📚 Documentation

- **[Complete Documentation](./DOCUMENTATION.md)** - Full technical documentation
- **[Documentation Index](./docs/README.md)** - Organized documentation structure
- **[Architecture Plan](./ARCHITECTURE_PIVOT_PLAN.md)** - Architecture decisions
- **[Quick Start Guide](./PIVOT_QUICK_START.md)** - Quick reference
- **[Mobile App README](./mobile/README.md)** - Mobile app setup
- **[Website README](./web/README.md)** - Website setup

## 🗂️ Project Structure

```
Dating App/
├── mobile/          # React Native app (primary product)
├── web/             # Static marketing site
├── db/              # Database migrations (shared)
└── docs/            # Documentation
```

## 🛠️ Tech Stack

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
- Supabase (PostgreSQL)
- Supabase Auth
- Supabase Realtime
- Supabase Storage

## 📖 Setup

See [DOCUMENTATION.md](./DOCUMENTATION.md) for complete setup instructions.

## 🔍 Documentation Quality

Run the documentation link checker to validate all markdown links:

```bash
npm run docs:check
```

### Quick Setup

1. **Clone repository**
2. **Setup Supabase** - Create project, run migrations
3. **Setup Mobile** - Install deps, add `.env`
4. **Setup Website** - Install deps, build static site

## 🧪 Testing

```bash
# Mobile app
cd mobile && npx tsc --noEmit

# Website
cd web && npm run build
```

## 🚢 Deployment

### Mobile App
- Build with EAS Build
- Submit to App Store / Play Store

### Website
- Deploy to Vercel (static export)
- Or any static hosting

## 📝 License

Private - All rights reserved

## 🔗 Links

- **Domain**: chemirl.app
- **Supabase**: [supabase.com](https://supabase.com)
- **Documentation**: See [DOCUMENTATION.md](./DOCUMENTATION.md)

---

**Status**: MVP Complete ✅  
**Last Updated**: After App-First Pivot
