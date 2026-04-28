-- Adds a `source` discriminator to waitlist_signups so the existing
-- waitlist table can carry both the rich Dublin launch signups
-- (source = 'waitlist', the default) and lightweight blog email
-- subscribers (source = 'blog_subscribe') from the marketing-site
-- sidebar. Keeping them in one table means one export, one unsubscribe
-- pipeline, and segmentation by source instead of by table.
--
-- The column is NOT NULL with a default so the existing rows backfill
-- cleanly to 'waitlist'. The CHECK constraint locks the vocabulary to
-- the two values we plan to support.

ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'waitlist'
    CHECK (source IN ('waitlist', 'blog_subscribe'));

-- PostgREST caches the schema; reload so the new column is visible to
-- any direct PostgREST clients (the edge function uses supabase-js, so
-- this is belt-and-braces).
SELECT pg_notify('pgrst', 'reload schema');
