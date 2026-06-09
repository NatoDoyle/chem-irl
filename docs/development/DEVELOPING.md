# Development Setup Guide

Copy-paste commands for setting up the development environment from scratch.

## Prerequisites

- Node.js 18+ and bun
- Expo CLI (for mobile): `bun install -g expo-cli`
- Supabase account: https://supabase.com
- Git repository cloned

---

## 1. Supabase Project Configuration

### Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization, name it (e.g., "chem-irl"), set database password
4. Wait for project to be provisioned (~2 minutes)

### Configure Auth Redirect URLs

1. In Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add these **Redirect URLs**:
   ```
   chemirl://auth/callback
   exp://localhost:8081/--/auth/callback
   ```
3. Click "Save"

### Create Storage Bucket

1. In Supabase Dashboard → **Storage**
2. Click "New bucket"
3. Configure bucket:
   - **Name**: `profiles`
   - **Public bucket**: ✅ Yes (enabled)
   - **File size limit**: 10 MB (or your preference)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp` (optional)
4. Click "Create bucket"

### Set Storage Policies (RLS)

1. Go to **Storage** → **Policies** → `profiles` bucket
2. Add policy: **Allow public read access**
   ```sql
   CREATE POLICY "Public Access" ON storage.objects
   FOR SELECT USING (bucket_id = 'profiles');
   ```
3. Add policy: **Allow authenticated users to upload**
   ```sql
   CREATE POLICY "Authenticated users can upload" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'profiles' AND
     auth.role() = 'authenticated'
   );
   ```
4. Add policy: **Users can update their own files**
   ```sql
   CREATE POLICY "Users can update own files" ON storage.objects
   FOR UPDATE USING (
     bucket_id = 'profiles' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```
5. Add policy: **Users can delete their own files**
   ```sql
   CREATE POLICY "Users can delete own files" ON storage.objects
   FOR DELETE USING (
     bucket_id = 'profiles' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

---

## 2. Database SQL Execution Order

> ⚠️ **For first-time bootstrap of a brand-new, empty project only.** `supabase/migrations/` is the source of truth for the deployed schema; the `db/*.sql` files are reference snapshots that may lag. For any existing or linked project, apply changes with `supabase db push` — do **not** paste `db/*.sql` into the SQL Editor, as it can drift from or overwrite applied migrations.

Run these SQL files in Supabase SQL Editor in this exact order:

### Step 1: Schema

1. Go to **SQL Editor** → **New query**
2. Open `db/schema.sql`
3. Copy entire contents and paste into SQL Editor
4. Click **Run** (or Ctrl+Enter / Cmd+Enter)
5. Wait for completion (~5-10 seconds)

### Step 2: Row Level Security

1. **New query** again
2. Open `db/rls.sql`
3. Copy entire contents and paste
4. Click **Run**
5. Wait for completion

### Step 3: Scoring Functions

1. **New query** again
2. Open `db/scoring.sql`
3. Copy entire contents and paste
4. Click **Run**
5. Wait for completion

### Step 4: KPI Views (Optional)

1. **New query** again
2. Open `db/kpi_views.sql`
3. Copy entire contents and paste
4. Click **Run**
5. Wait for completion

**Quick copy-paste order:**

```bash
# Files to run in order:
1. db/schema.sql
2. db/rls.sql
3. db/scoring.sql
4. db/kpi_views.sql
```

---

## 3. Mobile App Setup

### Install Dependencies

```bash
cd mobile
bun install
```

### Environment Variables

1. Get Supabase credentials:
   - Go to Supabase Dashboard → **Settings** → **API**
   - Copy **Project URL** and **anon public** key

2. Create `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your values:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=your_anon_key_here
   EXPO_PUBLIC_APP_URL=https://chemirl.app
   ```

### Run Development Server

```bash
bun start
```

This will:

- Start Metro bundler
- Show QR code in terminal
- Open Expo DevTools in browser

**To test on device:**

1. Install **Expo Go** app on your phone (iOS/Android)
2. Scan QR code from terminal
3. App loads on your device

**To test in simulator:**

```bash
bun run ios      # iOS simulator (macOS only)
bun run android  # Android emulator
bun run web      # Web browser (for quick testing)
```

---

## 4. Web Site Setup

### Install Dependencies

```bash
cd web
bun install
```

### Environment Variables (Optional)

The web site has defaults in `next.config.ts`, but you can override:

```bash
cp .env.example .env.local
```

Edit `.env.local` if you want to override defaults:

```env
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
```

### Run Development Server

```bash
bun run dev
```

Visit http://localhost:3000

**Build static site:**

```bash
bun run build
```

Output is in `out/` directory (deploy to any static hosting).

---

## Quick Start Summary

```bash
# 1. Supabase Setup (manual in dashboard)
# - Create project
# - Configure auth redirect URLs
# - Create storage bucket 'profiles'
# - Run SQL files in order: schema.sql, rls.sql, scoring.sql, kpi_views.sql

# 2. Mobile App
cd mobile
bun install
cp .env.example .env
# Edit .env with your Supabase credentials
bun start

# 3. Web Site (optional)
cd web
bun install
bun run dev
```

---

## Troubleshooting

### Mobile: "Unable to connect to Supabase"

- Check `.env` file exists and has correct values
- Verify Supabase project is active
- Restart Expo dev server: Press `r` in terminal or restart `bun start`

### Mobile: "Deep linking not working"

- Verify redirect URL `chemirl://auth/callback` is in Supabase Auth settings
- Test on physical device (not simulator/emulator)

### Mobile: "Photo upload fails"

- Check `profiles` bucket exists in Supabase Storage
- Verify bucket is public
- Check storage RLS policies allow authenticated uploads

### Database: "relation already exists" errors

- This is normal if running migrations multiple times
- Most errors can be ignored (tables already exist)
- If you need a clean slate, delete tables and re-run

### Web: "Module not found" errors

- Run `bun install` in `web/` directory
- Delete `node_modules` and `bun.lock`, then `bun install` again

---

## Next Steps

After setup is complete:

1. ✅ Test mobile app authentication flow
2. ✅ Test photo uploads
3. ✅ Test discovery feed
4. ✅ Test matches and proposals
5. ✅ Review [DOCUMENTATION.md](../archive/DOCUMENTATION.md) for architecture details
