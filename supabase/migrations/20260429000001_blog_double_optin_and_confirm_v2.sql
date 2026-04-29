-- Two-list email confirmation flow.
--
-- Adds two service-role RPCs:
--
--   1) claim_blog_subscribe(p_email, p_ip_hash)
--      Lightweight sibling of claim_waitlist_signup for the blog sidebar
--      form. Inserts (or refreshes the token of) a row with
--      source='blog_subscribe' and returns the confirmation token so the
--      edge function can send a double-opt-in email.
--
--   2) confirm_waitlist_email_v2(p_token)
--      Versioned successor to confirm_waitlist_email. Adds `email` and
--      `source` to the return shape so waitlist-confirm can dispatch the
--      post-confirm Resend audience push to the right audience based on
--      which list the user signed up for. The v1 function stays in place
--      per CLAUDE.md ("Do not change an existing RPC return shape in
--      place; create a versioned replacement such as `_v2`").
--
-- Both RPCs run as service_role only — REVOKE from PUBLIC/anon and grant
-- explicitly. They are called from the corresponding edge functions
-- (waitlist-blog-subscribe, waitlist-confirm) using the service-role key.

-- 1) claim_blog_subscribe ----------------------------------------------------

CREATE OR REPLACE FUNCTION claim_blog_subscribe(
  p_email   CITEXT,
  p_ip_hash TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing waitlist_signups%ROWTYPE;
  v_token    TEXT;
BEGIN
  SELECT * INTO v_existing FROM waitlist_signups WHERE email = p_email;
  IF FOUND THEN
    -- Re-issue a token only when the existing row is also a blog row AND
    -- the user hasn't confirmed yet. This lets a user who lost the first
    -- email recover by re-submitting. Cross-list cases (the email is
    -- already on the waitlist) and already-confirmed cases are silent
    -- no-ops — we don't want to send a "confirm your blog subscription"
    -- email to someone whose row will resolve to source='waitlist' on
    -- confirm, and we don't want to issue a new token to someone who's
    -- already confirmed on either list.
    IF v_existing.source = 'blog_subscribe'
       AND v_existing.email_confirmed_at IS NULL THEN
      v_token := encode(extensions.gen_random_bytes(24), 'hex');
      UPDATE waitlist_signups
      SET email_confirmation_token = v_token,
          consent_marketing        = TRUE,
          updated_at               = NOW()
      WHERE id = v_existing.id;

      RETURN jsonb_build_object(
        'success',                  TRUE,
        'was_new',                  FALSE,
        'email_confirmation_token', v_token
      );
    END IF;

    -- Already confirmed, or on the waitlist. No token, no email.
    RETURN jsonb_build_object('success', TRUE, 'was_new', FALSE);
  END IF;

  -- New blog subscriber.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO waitlist_signups (
    email,
    source,
    ip_hash,
    consent_marketing,
    email_confirmation_token
  ) VALUES (
    p_email,
    'blog_subscribe',
    p_ip_hash,
    TRUE,
    v_token
  );

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'was_new',                  TRUE,
    'email_confirmation_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION claim_blog_subscribe(CITEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_blog_subscribe(CITEXT, TEXT)
  TO service_role;

-- 2) confirm_waitlist_email_v2 ----------------------------------------------

CREATE OR REPLACE FUNCTION confirm_waitlist_email_v2(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup waitlist_signups%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_signup FROM waitlist_signups
  WHERE email_confirmation_token = p_token
    AND email_confirmed_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_or_used_token');
  END IF;

  UPDATE waitlist_signups
  SET email_confirmed_at       = NOW(),
      email_confirmation_token = NULL,
      updated_at               = NOW()
  WHERE id = v_signup.id;

  -- Referral scoring is a waitlist-only mechanic. Blog subscribers don't
  -- have a referred_by_code path and shouldn't trigger the helper.
  IF v_signup.source = 'waitlist'
     AND v_signup.referred_by_code IS NOT NULL THEN
    PERFORM apply_referral_score_for_signup(v_signup.id);
  END IF;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'email',         v_signup.email::text,
    'source',        v_signup.source,
    'position',      v_signup.position,
    'referral_code', v_signup.referral_code
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_waitlist_email_v2(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION confirm_waitlist_email_v2(TEXT)
  TO service_role;

-- PostgREST caches the schema. Reload so service-role callers see the new
-- functions immediately. supabase-js (used by the edge functions) goes
-- through PostgREST for .rpc() calls.
SELECT pg_notify('pgrst', 'reload schema');
