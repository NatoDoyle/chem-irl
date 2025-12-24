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

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

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

### ✅ Implemented (Phase 1)
- Auth flow (magic link)
- Navigation structure
- Basic screen placeholders

### 🚧 In Progress (Phase 2-4)
- Discovery feed
- Like/Match system
- Proposals
- Chat
- Profile management

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

```bash
# Build for iOS (requires macOS and Apple Developer account)
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)

