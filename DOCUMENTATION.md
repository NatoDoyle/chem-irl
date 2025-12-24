# Chem IRL - Complete Documentation

**Last Updated**: After App-First Pivot (Phase 2 Complete)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Setup Guide](#setup-guide)
5. [Mobile App](#mobile-app)
6. [Website](#website)
7. [Database](#database)
8. [API Reference](#api-reference)
9. [Development Guide](#development-guide)
10. [Deployment](#deployment)
11. [Testing](#testing)

---

## Overview

Chem IRL is a dating app that optimizes time-to-date through structured proposals, 72-hour expiries, and receiver-paid reopens. The app has been pivoted from web-first to **app-first**, with the mobile app as the primary experience and the website serving as a marketing/information site only.

### Current Status

- ✅ **Mobile App**: Complete MVP with all core features
- ✅ **Website**: Static marketing site
- ✅ **Backend**: Supabase (Postgres + Auth + Realtime + Storage)
- ✅ **Database**: Complete schema with RLS policies
- ✅ **Features**: Auth, Discovery, Matching, Proposals, Chat

### Tech Stack

**Mobile App**
- React Native (Expo SDK 54)
- TypeScript
- React Navigation v7
- Supabase Client (direct connection)
- Expo SecureStore (auth storage)

**Website**
- Next.js 16 (Static Export)
- TypeScript
- Tailwind CSS
- Deployed to Vercel

**Backend**
- Supabase (PostgreSQL)
- Supabase Auth (Magic Links)
- Supabase Realtime (Chat)
- Supabase Storage (Photos)
- RPC Functions (Business Logic)

**Third-Party Services**
- Stripe (Payments)
- Postmark (Email)
- PostHog (Analytics)
- Cloudflare (DNS/Email Routing)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  React Native App    │  │  Static Marketing Site   │ │
│  │  (Primary Product)    │  │  (Next.js Static)       │ │
│  │  - All features       │  │  - Landing page        │ │
│  │  - Direct Supabase    │  │  - How it works        │ │
│  │  - JWT tokens         │  │  - Download links      │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Direct Supabase Client
                          │ (JWT tokens, RLS)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                              │  │
│  │  - users, profiles, likes, matches               │  │
│  │  - proposals, confirms, messages                  │  │
│  │  - scores_daily, purchases, credits_ledger     │  │
│  │  - reports, enforcements                          │  │
│  │  - RLS policies enforced                          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Auth                                    │  │
│  │  - Magic link authentication                     │  │
│  │  - JWT token management                          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Realtime                                │  │
│  │  - Chat messages (subscriptions)                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Storage                                 │  │
│  │  - User photos (profiles bucket)                   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase RPC Functions                           │  │
│  │  - get_discovery_feed()                           │  │
│  │  - create_like_and_check_match()                  │  │
│  │  - get_user_matches()                             │  │
│  │  - update_action_speed()                          │  │
│  │  - update_profile_quality()                       │  │
│  │  - update_reliability()                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhooks/API
                          ▼
┌─────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                           │
│  - Stripe (Payments)                                     │
│  - Postmark (Email)                                      │
│  - PostHog (Analytics)                                   │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Direct Supabase Connection**: Mobile app connects directly to Supabase (no API layer)
   - Lower latency
   - Less code to maintain
   - RLS handles security
   - JWT tokens for auth

2. **Static Website**: Marketing site is static export
   - No server-side code
   - Fast loading
   - Easy deployment

3. **RPC Functions**: Business logic in database functions
   - Reusable across clients
   - Secure (SECURITY DEFINER)
   - Versioned with database

---

## Project Structure

```
Dating App/
├── mobile/                    # React Native app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── config/            # Brand constants
│   │   ├── lib/               # Utilities
│   │   │   ├── supabase/      # Supabase client
│   │   │   ├── auth.ts        # Auth helpers
│   │   │   ├── errors.ts      # Error utilities
│   │   │   └── types.ts        # TypeScript types
│   │   ├── navigation/        # Navigation setup
│   │   └── screens/           # App screens
│   │       ├── auth/          # Auth screens
│   │       ├── discover/     # Discovery feed
│   │       ├── matches/      # Matches, proposals, chat
│   │       ├── onboarding/   # Profile setup
│   │       └── profile/       # Profile screen
│   ├── App.tsx                # Root component
│   ├── app.json               # Expo config
│   └── package.json
│
├── web/                       # Static marketing site
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx       # Landing page
│   │       ├── download/      # Download page
│   │       └── how-it-works/  # How it works
│   ├── db/                    # Database migrations
│   │   ├── schema.sql         # Database schema
│   │   ├── rls.sql           # RLS policies
│   │   ├── kpi_views.sql     # KPI views
│   │   └── scoring.sql       # Scoring functions
│   └── next.config.ts         # Static export config
│
├── ARCHITECTURE_PIVOT_PLAN.md # Architecture plan
├── DOCUMENTATION.md           # This file
└── [other docs]
```

---

## Setup Guide

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (for mobile development)
- Supabase account
- Git

### 1. Clone Repository

```bash
git clone <repository-url>
cd "Dating App"
```

### 2. Mobile App Setup

```bash
cd mobile
npm install
```

Create `mobile/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

Run the app:
```bash
npm start
# Then scan QR code with Expo Go app
```

### 3. Website Setup

```bash
cd web
npm install
```

Create `web/.env.local` (for build-time constants):
```env
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app
```

Build static site:
```bash
npm run build
npm run start
```

### 4. Database Setup

1. Create Supabase project at https://supabase.com
2. Run SQL files in order (in Supabase SQL Editor):
   ```sql
   -- 1. Schema
   \i db/schema.sql
   
   -- 2. RLS Policies
   \i db/rls.sql
   
   -- 3. KPI Views
   \i db/kpi_views.sql
   
   -- 4. Scoring Functions
   \i db/scoring.sql
   ```

3. Enable Realtime for `messages` table:
   - Go to Database → Replication
   - Enable replication for `messages` table

4. Create Storage bucket:
   - Go to Storage
   - Create bucket: `profiles`
   - Set to public (or use signed URLs)

### 5. Environment Variables

**Mobile App** (`mobile/.env`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL`

**Website** (`web/.env.local`):
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_DOMAIN`
- `NEXT_PUBLIC_APP_URL`

**Supabase** (for webhooks/cron - if using):
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTMARK_API_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

## Mobile App

### Architecture

The mobile app uses **direct Supabase connection** - no API layer. All data operations go directly through Supabase client with RLS policies enforcing security.

### Navigation Structure

```
App.tsx (Root)
├── AuthNavigator (if not authenticated)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   └── MagicLinkSentScreen
│
├── OnboardingNavigator (if authenticated but profile incomplete)
│   ├── ProfileSetupScreen
│   └── PhotosScreen
│
└── MainNavigator (if authenticated and profile complete)
    ├── DiscoverTab
    │   └── DiscoverScreen
    │
    ├── MatchesStack
    │   ├── MatchesScreen
    │   ├── MatchDetailScreen
    │   ├── ProposeScreen
    │   └── ChatScreen
    │
    └── ProfileTab
        └── ProfileScreen
```

### Key Screens

#### Auth Flow
- **WelcomeScreen**: Landing page with "Get Started" button
- **LoginScreen**: Email input, sends magic link
- **MagicLinkSentScreen**: Confirmation message

#### Onboarding
- **ProfileSetupScreen**: Headline and bio input
- **PhotosScreen**: Photo upload (min 1, max 6)

#### Main App
- **DiscoverScreen**: Discovery feed with card stack
- **MatchesScreen**: List of all matches
- **MatchDetailScreen**: Match details, proposals, actions
- **ProposeScreen**: Create proposal (2-3 time windows)
- **ChatScreen**: Real-time chat (unlocked after confirm)
- **ProfileScreen**: User profile and settings

### Components

- **DiscoveryCardStack**: Card stack with swipe gestures
- **DiscoveryCard**: Individual profile card
- **MatchModal**: Match notification modal
- **ProposalCard**: Display and confirm proposals

### Supabase Integration

#### Authentication
```typescript
import { supabase } from './src/lib/supabase/client';

// Send magic link
await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: Linking.createURL('/auth/callback'),
  },
});

// Get session
const { data: { session } } = await supabase.auth.getSession();

// Sign out
await supabase.auth.signOut();
```

#### RPC Functions
```typescript
// Get discovery feed
const { data, error } = await supabase.rpc('get_discovery_feed', {
  p_viewer: userId,
  p_limit: 20,
});

// Like user and check for match
const { data, error } = await supabase.rpc('create_like_and_check_match', {
  p_liker: userId,
  p_likee: targetUserId,
});
```

#### Direct Queries
```typescript
// Insert proposal
const { error } = await supabase.from('proposals').insert({
  match_id: matchId,
  sender_id: userId,
  windows: [...],
  date_types: [...],
  note: '...',
  expires_at: '...',
  status: 'active',
});

// Get matches
const { data } = await supabase
  .from('matches')
  .select('*')
  .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  .eq('status', 'open');
```

#### Realtime Subscriptions
```typescript
// Subscribe to messages
const channel = supabase
  .channel(`match:${matchId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `match_id=eq.${matchId}`,
  }, (payload) => {
    // Handle new message
    const newMessage = payload.new as Message;
    setMessages(prev => [...prev, newMessage]);
  })
  .subscribe();

// Cleanup
return () => {
  supabase.removeChannel(channel);
};
```

#### Storage
```typescript
// Upload photo
const { data, error } = await supabase.storage
  .from('profiles')
  .upload(`${userId}/${fileName}`, blob);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('profiles')
  .getPublicUrl(fileName);
```

### Deep Linking

Magic links use the scheme `chemirl://auth/callback`. Configured in `app.json`:

```json
{
  "expo": {
    "scheme": "chemirl"
  }
}
```

The app handles deep links in `App.tsx`:
- Initial URL on app open
- URL changes while app is running

---

## Website

### Purpose

The website is now a **static marketing site only**. It does not contain any product functionality.

### Pages

- **`/`** - Landing page (hero, how it works, features)
- **`/download`** - App download links and waitlist
- **`/how-it-works`** - Detailed how it works page

### Configuration

Static export configured in `next.config.ts`:
```typescript
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

### Deployment

Deploy to Vercel or any static hosting:
```bash
cd web
npm run build
# Output in web/out/
```

---

## Database

### Schema Overview

**Core Tables**
- `users` - User accounts (email, phone, dob, gender, orientation)
- `profiles` - Extended profiles (prompts, photos, availability, completion_pct)
- `likes` - Like relationships (liker_id, likee_id)
- `matches` - Mutual likes (user_a, user_b, status)
- `proposals` - Time proposals (windows, date_types, note, expires_at)
- `confirms` - Confirmed time slots (proposal_id, chosen_window)
- `messages` - Chat messages (match_id, sender_id, content)

**Scoring & Metrics**
- `scores_daily` - Daily Action Speed, Profile Quality, Reliability scores
- `surveys` - Post-date feedback

**Monetization**
- `purchases` - Stripe transactions
- `credits_ledger` - Credit usage tracking

**Safety**
- `reports` - User reports
- `enforcements` - Moderation actions

### RPC Functions

#### `get_discovery_feed(p_viewer UUID, p_limit INTEGER)`
Returns discovery candidates for a user, ordered by scores.

**Returns:**
- `user_id`, `headline`, `bio`, `availability_summary`
- `action_speed`, `profile_quality`, `reliability`

**Filters:**
- Excludes already liked users
- Excludes existing matches
- Only profiles with `completion_pct >= 80`

#### `create_like_and_check_match(p_liker UUID, p_likee UUID)`
Creates a like and checks for mutual like (match).

**Returns:**
- `like_id`
- `matched` (boolean)
- `match_id` (if matched)

**Actions:**
- Inserts like (or returns existing)
- Checks for mutual like
- Creates match if mutual like exists

#### `get_user_matches(user_uuid UUID)`
Returns all matches for a user.

**Returns:**
- `match_id`, `other_user_id`, `other_user_email`, `created_at`

#### `update_action_speed(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)`
Updates Action Speed score based on event.

#### `update_profile_quality(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)`
Updates Profile Quality score based on event.

#### `update_reliability(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)`
Updates Reliability score based on event.

### Row Level Security (RLS)

All tables have RLS enabled. Policies ensure:
- Users can only see their own data
- Users can only see data from their matches
- Users can only insert/update their own data
- System functions can manage scores and credits

---

## API Reference

### Mobile App → Supabase

The mobile app uses Supabase directly. No REST API layer.

#### Authentication
- `supabase.auth.signInWithOtp()` - Send magic link
- `supabase.auth.getSession()` - Get current session
- `supabase.auth.signOut()` - Sign out
- `supabase.auth.onAuthStateChange()` - Listen for auth changes

#### RPC Functions
- `supabase.rpc('get_discovery_feed', { p_viewer, p_limit })`
- `supabase.rpc('create_like_and_check_match', { p_liker, p_likee })`
- `supabase.rpc('get_user_matches', { p_user_id })`
- `supabase.rpc('update_action_speed', { p_user_id, p_event_type, p_metadata })`
- `supabase.rpc('update_profile_quality', { p_user_id, p_event_type, p_metadata })`
- `supabase.rpc('update_reliability', { p_user_id, p_event_type, p_metadata })`

#### Direct Queries
- `supabase.from('profiles').select().eq('user_id', id)`
- `supabase.from('matches').select().or('user_a.eq.id,user_b.eq.id')`
- `supabase.from('proposals').insert({ ... })`
- `supabase.from('confirms').insert({ ... })`
- `supabase.from('messages').insert({ ... })`

#### Realtime
- `supabase.channel('match:${matchId}').on('postgres_changes', ...).subscribe()`

#### Storage
- `supabase.storage.from('profiles').upload(path, blob)`
- `supabase.storage.from('profiles').getPublicUrl(path)`

### Webhooks (If Needed)

If you need webhooks for Stripe, Postmark, or cron jobs, they should be deployed separately (not part of static site). Options:
1. Supabase Edge Functions
2. Separate Next.js API routes (deployed to Vercel)
3. Standalone serverless functions

---

## Development Guide

### Adding a New Screen

1. Create screen component in `mobile/src/screens/`
2. Add route to appropriate navigator
3. Update TypeScript types if needed

Example:
```typescript
// mobile/src/screens/settings/SettingsScreen.tsx
export default function SettingsScreen() {
  // ...
}

// mobile/src/navigation/MainNavigator.tsx
<Tab.Screen name="Settings" component={SettingsScreen} />
```

### Adding a New RPC Function

1. Create function in Supabase SQL Editor
2. Add to `web/db/` (for version control)
3. Call from mobile app

Example:
```sql
CREATE OR REPLACE FUNCTION my_new_function(p_param UUID)
RETURNS TABLE(...)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ...;
$$;
```

### Adding a New Database Table

1. Add table to `db/schema.sql`
2. Add RLS policies to `db/rls.sql`
3. Run migrations in Supabase
4. Update TypeScript types in `mobile/src/lib/types.ts`

### Error Handling

Use centralized error utilities:
```typescript
import { formatError, getUserErrorMessage } from '../lib/errors';

try {
  // ...
} catch (error) {
  const message = getUserErrorMessage(error);
  Alert.alert('Error', message);
}
```

### Testing

```bash
# TypeScript check
cd mobile && npx tsc --noEmit

# Run app
npm start

# Build website
cd web && npm run build
```

---

## Deployment

### Mobile App

#### Development
```bash
cd mobile
npm start
# Scan QR code with Expo Go
```

#### Production Build

**Using EAS Build:**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**Environment Variables:**
Set in EAS dashboard or `eas.json`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_URL`

### Website

#### Vercel (Recommended)
```bash
cd web
vercel
```

Or connect GitHub repo to Vercel dashboard.

#### Other Static Hosting
```bash
cd web
npm run build
# Deploy web/out/ directory
```

### Database

Database is managed in Supabase. Migrations are run manually in SQL Editor.

**Migration Process:**
1. Update SQL files in `web/db/`
2. Run in Supabase SQL Editor
3. Test in staging first
4. Run in production

---

## Testing

### Manual Testing Checklist

**Auth Flow**
- [ ] Send magic link
- [ ] Click link in email
- [ ] App opens and authenticates
- [ ] Session persists on app restart

**Onboarding**
- [ ] Profile setup (headline, bio)
- [ ] Photo upload (min 1, max 6)
- [ ] Profile completion detection

**Discovery**
- [ ] Feed loads
- [ ] Swipe right (like)
- [ ] Swipe left (pass)
- [ ] Like button works
- [ ] Pass button works
- [ ] Match notification appears

**Matches**
- [ ] Matches list loads
- [ ] Match detail shows proposals
- [ ] Create proposal (2-3 windows)
- [ ] Confirm proposal
- [ ] "None suits" flow

**Chat**
- [ ] Chat unlocks after confirm
- [ ] Send message
- [ ] Receive message (realtime)
- [ ] Messages persist

### Automated Testing

Not yet implemented. Consider adding:
- Unit tests (Jest)
- Integration tests (Detox)
- E2E tests (Maestro)

---

## Troubleshooting

### Common Issues

**Mobile App Won't Start**
- Check `.env` file exists and has correct values
- Run `npm install` again
- Clear Expo cache: `expo start -c`

**Auth Not Working**
- Check Supabase URL and keys
- Verify deep linking scheme in `app.json`
- Check email redirect URL in Supabase Auth settings

**Database Errors**
- Verify RLS policies are correct
- Check user has proper permissions
- Verify RPC functions exist

**Realtime Not Working**
- Enable Realtime for `messages` table in Supabase
- Check subscription is active
- Verify match_id filter is correct

**Photo Upload Fails**
- Check Storage bucket exists (`profiles`)
- Verify bucket permissions
- Check file size limits

---

## Next Steps

### Immediate
1. Test all flows end-to-end
2. Fix any bugs found
3. Prepare for App Store submission

### Short Term
1. Add proper date/time picker
2. Implement push notifications
3. Add analytics (PostHog)
4. Improve error handling

### Long Term
1. Add profile editing
2. Implement availability preferences
3. Add reporting/blocking in mobile
4. Add admin panel
5. Implement scoring engine UI

---

## Resources

### Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase RPC Functions](https://supabase.com/docs/guides/database/functions)

### Related Files
- `ARCHITECTURE_PIVOT_PLAN.md` - Architecture decision document
- `PHASE1_COMPLETE.md` - Phase 1 summary
- `PHASE2_COMPLETE.md` - Phase 2 summary
- `POLISH_COMPLETE.md` - Polish improvements
- `mobile/README.md` - Mobile app quick start
- `web/README.md` - Website documentation

---

## Support

For issues or questions:
1. Check this documentation
2. Review error messages
3. Check Supabase logs
4. Review code comments

---

**Last Updated**: After App-First Pivot (Phase 2 Complete)
**Version**: 1.0.0 (MVP)

