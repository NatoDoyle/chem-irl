-- waitlist_position_for_code_v2: adds pending_referred_count alongside the
-- v1 fields. pending = referred signups that haven't confirmed their email
-- yet (no waitlist_referrals row, no score awarded). The marketing success
-- page uses it to show "N friends signed up, waiting on them to confirm",
-- which explains why a referrer's score hasn't moved.
--
-- v1 (waitlist_position_for_code) is left in place. Grants mirror v1
-- exactly: EXECUTE to anon, authenticated (default PUBLIC execute retained).
CREATE OR REPLACE FUNCTION public.waitlist_position_for_code_v2(p_code TEXT)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'position', s.position,
    'referred_count', (
      SELECT COUNT(*)::INT FROM waitlist_referrals r
      WHERE r.referrer_id = s.id
    ),
    'pending_referred_count', (
      SELECT COUNT(*)::INT FROM waitlist_signups c
      WHERE c.referred_by_code = s.referral_code
        AND c.source = 'waitlist'
        AND c.email_confirmed_at IS NULL
    ),
    'gender_weighted_score', s.gender_weighted_score,
    'email_confirmed', (s.email_confirmed_at IS NOT NULL)
  )
  FROM waitlist_signups s
  WHERE s.referral_code = p_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.waitlist_position_for_code_v2(TEXT) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
