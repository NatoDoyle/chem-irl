-- Support submissions: bug reports, feature requests, contact messages,
-- and user-shared tips. Single table with a `kind` discriminator so the
-- /support page on the marketing site can post all four through one
-- edge function (`support-submit`) without per-kind tables.
--
-- Public read of approved tips goes through list_published_tips (a
-- SECURITY DEFINER RPC with a hard-coded column allowlist), not a view —
-- so the safe-column contract lives in one auditable function body.
--
-- Inserts go through submit_support_request (SECURITY DEFINER, callable
-- only by service_role from the edge function). RLS is enabled with no
-- anon/authenticated policies so direct PostgREST writes/reads are
-- impossible.
--
-- Tip moderation (pre-launch): manual SQL update flips status to
-- 'published' and copies cleaned text into published_title /
-- published_body. A future admin UI would add a `triage_support_submission`
-- RPC alongside the existing two.

CREATE TYPE support_kind AS ENUM ('bug', 'feature', 'contact', 'tip');
CREATE TYPE support_status AS ENUM (
  'new',        -- just submitted, awaiting triage
  'triaged',    -- internal team has acknowledged
  'resolved',   -- terminal state for bug/feature/contact
  'published',  -- terminal state for tip — visible publicly
  'rejected'    -- terminal state for spam / off-topic / declined
);

CREATE TABLE support_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind support_kind NOT NULL,
  status support_status NOT NULL DEFAULT 'new',

  -- Submitter identity. Email is required for bug/feature/contact and
  -- optional for tip — that rule is enforced in the edge function, not
  -- the DB, so product can shift it without a migration.
  email CITEXT
    CHECK (email IS NULL OR (length(email) BETWEEN 5 AND 320 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  display_name TEXT
    CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 80),

  -- Submission body. `subject` is the one-liner, `body` is the long form.
  -- `metadata` is a kind-specific JSONB grab-bag (bug: app_version, os,
  -- steps_to_reproduce; feature: use_case; contact: topic; tip: tip_topic,
  -- source_url) — keys are whitelisted by the edge function.
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 3 AND 200),
  body    TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 5000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Tip publishable surface. NULL until a moderator publishes the tip.
  -- These are deliberately distinct from raw subject/body so the
  -- moderator can sanitize before publishing.
  published_title TEXT
    CHECK (published_title IS NULL OR length(published_title) BETWEEN 3 AND 120),
  published_body TEXT
    CHECK (published_body IS NULL OR length(published_body) BETWEEN 10 AND 2000),
  published_at TIMESTAMPTZ,

  -- Anti-abuse fingerprint. Same column shape as waitlist_signups so
  -- shared mental model survives.
  ip_hash TEXT,
  user_agent TEXT,

  -- Internal-only triage notes. Never exposed to anon.
  triage_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moderation index: "show me all new bugs / new features / etc."
CREATE INDEX idx_support_submissions_kind_status_created
  ON support_submissions (kind, status, created_at DESC);

-- Public-tip read path: only published tips, newest first. Partial index
-- so it stays small and is the obvious plan for list_published_tips().
CREATE INDEX idx_support_submissions_published_tips
  ON support_submissions (published_at DESC)
  WHERE kind = 'tip' AND status = 'published';

-- Rate-limit query: "this IP hash, in the last hour."
CREATE INDEX idx_support_submissions_ip_recent
  ON support_submissions (ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE support_submissions ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for anon or authenticated. All writes go
-- through submit_support_request (service_role only). All public reads
-- go through list_published_tips. Direct PostgREST access is impossible.

-- ---------------------------------------------------------------------------
-- Public RPC: list_published_tips
--
-- Anon-callable. Returns only safe columns (id, title, body, published_at,
-- display_name) — never email, ip_hash, user_agent, raw subject/body, or
-- metadata. Limit is clamped to 50 to bound payload size.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION list_published_tips(
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS jsonb
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tips',  COALESCE(jsonb_agg(t), '[]'::jsonb),
    'total', (
      SELECT COUNT(*) FROM support_submissions
      WHERE kind = 'tip' AND status = 'published'
    )
  )
  FROM (
    SELECT
      id,
      published_title AS title,
      published_body  AS body,
      published_at,
      display_name
    FROM support_submissions
    WHERE kind = 'tip' AND status = 'published'
    ORDER BY published_at DESC NULLS LAST
    LIMIT  LEAST(GREATEST(p_limit, 1), 50)
    OFFSET GREATEST(p_offset, 0)
  ) t;
$$;

REVOKE ALL ON FUNCTION list_published_tips(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_published_tips(INT, INT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Service-role RPC: submit_support_request
--
-- Called by the support-submit edge function (with service_role). Inserts
-- a new row with the kind/status defaults and returns the new id. Returns
-- a structured error in the (defensive) bad-kind case so the edge function
-- can map to a clean error response.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_support_request(
  p_kind         TEXT,
  p_email        CITEXT,
  p_display_name TEXT,
  p_subject      TEXT,
  p_body         TEXT,
  p_metadata     JSONB,
  p_ip_hash      TEXT,
  p_user_agent   TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_kind NOT IN ('bug', 'feature', 'contact', 'tip') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_kind');
  END IF;

  INSERT INTO support_submissions (
    kind, email, display_name, subject, body, metadata, ip_hash, user_agent
  ) VALUES (
    p_kind::support_kind,
    p_email,
    p_display_name,
    p_subject,
    p_body,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_hash,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', TRUE, 'submission_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_support_request(
  TEXT, CITEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_support_request(
  TEXT, CITEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) TO service_role;

-- PostgREST schema cache reload — required because we added an
-- anon-callable RPC (list_published_tips). Without this, anon clients
-- will get "function not found" until the next pgrst reload.
SELECT pg_notify('pgrst', 'reload schema');
