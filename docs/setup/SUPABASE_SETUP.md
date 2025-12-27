# Supabase Connection Setup Guide

## Step 1: Get Your Supabase Keys

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Click on your project
3. Go to **Settings** → **API**
4. Copy these values:
   - **Project URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → Copy the `anon` `public` key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys** → Copy the `service_role` `secret` key → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your **chem-irl** project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

```
NEXT_PUBLIC_SUPABASE_URL
https://your-project-id.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
your-anon-key-here

SUPABASE_SERVICE_ROLE_KEY
your-service-role-key-here
```

**Important:**
- ✅ Check all 3 environments: Production, Preview, Development
- ✅ `SUPABASE_SERVICE_ROLE_KEY` should **NOT** have `NEXT_PUBLIC_` prefix (server-side only!)
- ✅ After adding, **redeploy** your project

## Step 3: Test the Connection

After redeploying, your app should be connected to Supabase. The connection files are already set up:

- ✅ Client-side: `src/lib/supabase/client.ts`
- ✅ Server-side: `src/lib/supabase/server.ts`
- ✅ Middleware: `src/middleware.ts` (for session refresh)

## Step 4: Verify Connection (Optional)

You can test the connection by creating a simple API route:

```typescript
// src/app/api/test-supabase/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('users').select('count')
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  
  return Response.json({ success: true, count: data })
}
```

## Usage Examples

### In Client Components (React Components)
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function MyComponent() {
  const supabase = createClient()
  
  // Use supabase here
  const { data } = await supabase.from('users').select('*')
}
```

### In Server Components
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MyComponent() {
  const supabase = await createClient()
  
  // Use supabase here
  const { data } = await supabase.from('users').select('*')
}
```

### In API Routes
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('*')
  return Response.json(data)
}
```

## Security Notes

⚠️ **Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code!**

- ✅ Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-side
- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` only in API routes (server-side)
- ✅ The service role key bypasses RLS - use carefully!

## Troubleshooting

### "Invalid API key" error
- Check environment variables are set correctly in Vercel
- Verify you copied the entire key (no spaces/line breaks)
- Make sure you redeployed after adding variables

### "Failed to fetch" error
- Check your Supabase project URL is correct
- Verify your Supabase project is active
- Check CORS settings in Supabase (should allow your domain)

### Authentication not working
- Check middleware is set up correctly
- Verify RLS policies are in place
- Check browser console for errors

## Next Steps

After connecting Supabase:
1. ✅ Database is ready (migrations run)
2. ✅ RLS policies are active
3. ✅ Environment variables set
4. ➡️ Set up authentication flow
5. ➡️ Create profile pages
6. ➡️ Build discovery feed

Your Supabase connection is ready! 🚀
