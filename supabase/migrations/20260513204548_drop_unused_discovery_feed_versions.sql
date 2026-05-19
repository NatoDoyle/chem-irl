-- Drops superseded discovery-feed RPCs. v4 (created in
-- 20260429120001_discovery_filters_v4.sql) is the only version called by
-- the mobile client (verified: rg "get_discovery_feed_v[23]" against
-- mobile/, web/, scripts/, and supabase/functions/ found no callers
-- outside the migration files that originally defined the functions).
--
-- db/rls.sql still contains a stale CREATE OR REPLACE FUNCTION snapshot
-- for v2; that's documented in CLAUDE.md ("db/ may lag behind applied
-- migrations") and is out of scope here.

DROP FUNCTION IF EXISTS get_discovery_feed_v2(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_discovery_feed_v3(UUID, INTEGER);

SELECT pg_notify('pgrst', 'reload schema');
