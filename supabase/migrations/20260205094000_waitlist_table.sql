-- Create waitlist_signups table for marketing site

-- Ensure pgcrypto is available for gen_random_uuid (additive, safe if already installed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  waitlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated inserts (no reads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'waitlist_signups'
      AND policyname = 'waitlist_insert'
  ) THEN
    CREATE POLICY "waitlist_insert" ON public.waitlist_signups
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

