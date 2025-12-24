// Supabase client for browser/client-side usage
// NOTE: This is a placeholder. The web site is a static marketing site and does not use Supabase.
// This file exists only to prevent import errors if referenced in documentation or future code.
// The mobile app uses Supabase directly - see ../mobile/src/lib/supabase/client.ts

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Note: The web site is a static marketing site and does not require Supabase.'
    );
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

