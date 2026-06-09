-- Read-only, aggregate-only marketing snapshot for the CMO Sense layer.
create or replace function public.marketing_waitlist_snapshot()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total',            count(*) filter (where city = 'dublin'),
    'confirmed',        count(*) filter (where city = 'dublin' and email_confirmed_at is not null),
    'female',           count(*) filter (where city = 'dublin' and gender = 'female'),
    'male',             count(*) filter (where city = 'dublin' and gender = 'male'),
    'confirmed_female', count(*) filter (where city = 'dublin' and gender = 'female' and email_confirmed_at is not null),
    'confirmed_male',   count(*) filter (where city = 'dublin' and gender = 'male'   and email_confirmed_at is not null),
    'week_total',       count(*) filter (where city = 'dublin' and created_at >= now() - interval '7 days'),
    'week_confirmed',   count(*) filter (where city = 'dublin' and email_confirmed_at is not null and email_confirmed_at >= now() - interval '7 days')
  )
  from public.waitlist_signups;
$$;

revoke all on function public.marketing_waitlist_snapshot() from public;
grant execute on function public.marketing_waitlist_snapshot() to anon;

select pg_notify('pgrst', 'reload schema');
