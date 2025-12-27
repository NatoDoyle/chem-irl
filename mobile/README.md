# Chem IRL Mobile App

React Native mobile app for Chem IRL dating platform.

## Tech Stack

- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: React Navigation v7
- **Backend**: Supabase (direct connection)
- **Auth**: Supabase Auth (JWT tokens)
- **Storage**: Expo SecureStore

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `mobile/` directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_publishable_key
EXPO_PUBLIC_APP_URL=https://chemirl.app

# Optional: Error logging with Sentry
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
EXPO_PUBLIC_ENVIRONMENT=development  # or production, staging, etc.
```

**Important:** 
- Variables must start with `EXPO_PUBLIC_` to be accessible in the app
- Restart Expo dev server after creating/updating `.env`
- Get credentials from [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API
- Never commit `.env` to git (already in `.gitignore`)

### 3. Run the App

```bash
# Start Expo dev server
npm start

# Run on iOS (requires macOS)
npm run ios

# Run on Android
npm run android

# Run on web (for testing)
npm run web
```

## Project Structure

```
mobile/
├── src/
│   ├── config/          # Brand constants
│   ├── lib/             # Utilities and clients
│   │   ├── supabase/    # Supabase client setup
│   │   └── types.ts     # TypeScript types
│   ├── navigation/      # Navigation setup
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   └── screens/         # App screens
│       ├── auth/        # Auth screens
│       ├── discover/    # Discovery feed
│       ├── matches/     # Matches and chat
│       └── profile/     # Profile and settings
├── App.tsx              # Root component
└── app.json             # Expo configuration
```

## Features

### ✅ Fully Implemented

- Auth flow (magic link with deep linking)
- Navigation structure (Auth → Onboarding → Main)
- Discovery feed with swipe mechanics
- Like/Match system
- Proposal creation and confirmation
- Real-time chat
- Photo upload and management
- Profile setup (onboarding)

### 🚧 Partial / Needs Work

- Profile screen (view/edit existing profile) - Currently a stub
- Error handling (utilities exist but not widely used)
- Offline support (no retry logic or queue)

## Development

### Adding New Screens

1. Create screen component in `src/screens/`
2. Add route to appropriate navigator (`AuthNavigator` or `MainNavigator`)
3. Update TypeScript types if needed

### Supabase Integration

The app uses Supabase directly (no API layer). Example:

```typescript
import { supabase } from './src/lib/supabase/client';

// Call RPC function
const { data, error } = await supabase.rpc('get_discovery_feed', {
  p_viewer: userId,
  p_limit: 24,
});

// Insert data
const { data, error } = await supabase
  .from('proposals')
  .insert({ ... });
```

### Deep Linking

Magic links use the scheme `chemirl://auth/callback`. Configure in `app.json`:

```json
{
  "expo": {
    "scheme": "chemirl"
  }
}
```

## Building for Production

Before building, run the release checklist to ensure everything is ready:
- See `docs/RELEASE_CHECKLIST.md` for complete verification steps

```bash
# Build for iOS (requires macOS and Apple Developer account)
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Testing

### Recommended Workflow

**Quick start:** Run `npm run test:two-device` to see the complete workflow.

1. **Verify staging setup:**
   ```bash
   npm run use:staging
   npm start  # Restart required after switching
   npm run verify:staging
   ```

2. **Install on phones:**
   - See [`docs/INSTALL_ON_PHONES.md`](./docs/INSTALL_ON_PHONES.md) for Expo Go or EAS dev build instructions

3. **Run two-device test plan:**
   - Follow [`docs/TWO_DEVICE_TEST_PLAN.md`](./docs/TWO_DEVICE_TEST_PLAN.md) step-by-step

4. **Record results:**
   - Run `npm run test:log:new` to generate a prefilled test run log
   - Or use [`docs/TEST_RUN_LOG_TEMPLATE.md`](./docs/TEST_RUN_LOG_TEMPLATE.md) manually

### Documentation

See [`docs/README.md`](./docs/README.md) for complete documentation index.

**Quick links:**
- **[Install on Phones](./docs/INSTALL_ON_PHONES.md)** - Expo Go and EAS dev build installation
- **[Supabase Staging Setup](./docs/SUPABASE_STAGING_SETUP.md)** - Staging project setup and environment switching
- **[Two-Device Test Plan](./docs/TWO_DEVICE_TEST_PLAN.md)** - Step-by-step testing workflow
- **[Test Run Log Template](./docs/TEST_RUN_LOG_TEMPLATE.md)** - Template for recording test sessions
- **[Release Checklist](./docs/RELEASE_CHECKLIST.md)** - Pre-build checks and verification steps

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
