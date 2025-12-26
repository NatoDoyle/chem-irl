# Mobile App Environment Setup

## Required Environment Variables

Create a `.env` file in the `mobile/` directory with the following:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_publishable_key_here
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

## How to Get Supabase Credentials

1. Go to your Supabase project dashboard: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** → Use for `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → Use for `EXPO_PUBLIC_SUPABASE_KEY`

## Example

```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

## Important Notes

- ⚠️ **Never commit `.env` to git** (it's already in `.gitignore`)
- ✅ All variables must start with `EXPO_PUBLIC_` to be accessible in the app
- ✅ Restart Expo dev server after creating/updating `.env`
- ✅ These are public keys (safe to expose in client-side code)

## After Creating .env

1. Save the `.env` file in `mobile/` directory
2. Restart Expo dev server:
   ```bash
   npm start
   ```
3. The app will now connect to your Supabase project!

