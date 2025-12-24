// Supabase client for server-side usage (API routes, server components)
// NOTE: The web site is a static marketing site (output: 'export') and does not currently use Supabase.
// This file exists to prevent import errors if referenced in documentation.
// Server-side functionality (webhooks, cron) should be implemented as Supabase Edge Functions, not Next.js API routes.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // For server-side, prefer service role key if available (bypasses RLS)
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

