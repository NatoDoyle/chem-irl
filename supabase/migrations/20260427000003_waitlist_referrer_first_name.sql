-- ============================================================================
-- Migration: waitlist_referrer_first_name RPC
-- Created:   2026-04-27
-- Purpose:   Lets the marketing site show "[Name] sent you" on /download
--           when ?ref=CODE is present in the URL. Returns just the
--           referrer's first_name (or NULL if they didn't provide one).
--
--           Privacy:
--             - Only first_name is exposed. No email, no last name, no
--               other PII leaves the database.
--             - The caller must already know the referral_code, which is
--               48 random bits (12 hex chars, ~280 trillion combos).
--               Enumeration is impractical.
--             - The code is shared with referees deliberately by the
--               referrer (it's the whole point of the referral link).
-- ============================================================================

CREATE OR REPLACE FUNCTION waitlist_referrer_first_name(p_code TEXT)
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT first_name
  FROM waitlist_signups
  WHERE referral_code = p_code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION waitlist_referrer_first_name(TEXT) TO anon, authenticated;

SELECT pg_notify('pgrst', 'reload schema');
