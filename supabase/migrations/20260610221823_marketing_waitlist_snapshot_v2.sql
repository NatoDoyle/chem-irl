-- ============================================================================
-- Migration: marketing_waitlist_snapshot_v2 (channel attribution reporting)
-- Created:   2026-06-10
-- Purpose:   The CMO digest needs per-channel signups now that UTM capture is
--            live (migration 20260609190942): per-utm_source splits, referral
--            counts, and share-channel clicks. v1 stays untouched (versioned
--            replacement per repo rule); the VPS connector moves to v2.
--
-- Differences from v1 (deliberate fixes, documented):
--   * Scalar counts are scoped to source = 'waitlist' — v1 counted every
--     city='dublin' row, which silently included blog_subscribe rows.
--   * Adds: referred / week_referred scalars, utm_sources[] (top 12 by total,
--     NULL → 'untagged'), share_channels[] (clicks per share button).
--
-- Security model: identical to v1 — SECURITY DEFINER, aggregate-only, no PII,
-- EXECUTE granted to anon (called by the CMO over PostgREST with the
-- publishable key).
-- ============================================================================

create or replace function public.marketing_waitlist_snapshot_v2()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total',            count(*),
    'confirmed',        count(*) filter (where email_confirmed_at is not null),
    'female',           count(*) filter (where gender = 'female'),
    'male',             count(*) filter (where gender = 'male'),
    'confirmed_female', count(*) filter (where gender = 'female' and email_confirmed_at is not null),
    'confirmed_male',   count(*) filter (where gender = 'male'   and email_confirmed_at is not null),
    'week_total',       count(*) filter (where created_at >= now() - interval '7 days'),
    'week_confirmed',   count(*) filter (where email_confirmed_at is not null and email_confirmed_at >= now() - interval '7 days'),
    'referred',         count(*) filter (where referred_by_code is not null),
    'week_referred',    count(*) filter (where referred_by_code is not null and created_at >= now() - interval '7 days'),
    'utm_sources', (
      select coalesce(json_agg(row_to_json(u)), '[]'::json) from (
        select coalesce(utm_source, 'untagged') as source,
               count(*)::int as total,
               (count(*) filter (where email_confirmed_at is not null))::int as confirmed,
               (count(*) filter (where created_at >= now() - interval '7 days'))::int as week_total
        from waitlist_signups
        where city = 'dublin' and source = 'waitlist'
        group by 1
        order by 2 desc, 1
        limit 12
      ) u
    ),
    'share_channels', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json) from (
        select channel,
               count(*)::int as clicks,
               (count(*) filter (where created_at >= now() - interval '7 days'))::int as week_clicks
        from waitlist_share_events
        group by 1
        order by 2 desc, 1
      ) s
    )
  )
  from waitlist_signups
  where city = 'dublin' and source = 'waitlist';
$$;

revoke all on function public.marketing_waitlist_snapshot_v2() from public;
grant execute on function public.marketing_waitlist_snapshot_v2() to anon;

select pg_notify('pgrst', 'reload schema');
