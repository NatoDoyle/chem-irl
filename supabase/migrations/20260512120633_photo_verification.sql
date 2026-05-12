-- =============================================================================
-- Migration: Photo safety + identity verification
-- =============================================================================
-- Adds:
--   1. photo_verification_checks   -- per-call audit log for Claude moderation
--                                     (rows for both 'safety' and 'match' ops)
--   2. profiles.verification_status, .verification_completed_at,
--      .verification_selfie_path   -- denormalized current state
--
-- Service-role writes only (via the moderate-photo edge function).
-- Clients SELECT their own audit rows under RLS to render "why blocked"
-- detail. No RPCs; reads are single-table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. photo_verification_checks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS photo_verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'safety' = single-photo gallery safety scan (8 categories)
  -- 'match'  = selfie <-> gallery same-person comparison
  kind TEXT NOT NULL CHECK (kind IN ('safety', 'match')),

  -- Storage path within bucket=`profiles`, e.g. '<uuid>/1714600000000.jpg'.
  -- Recorded as a path (not a public URL) so the row stays valid if the
  -- bucket goes private later.
  photo_path TEXT NOT NULL,

  -- Only set when kind='match'. The selfie photo_path was compared against.
  -- Convention: '<uuid>/verification/<ts>.jpg'.
  compare_path TEXT,

  -- 'safety' rows: 'approved' | 'review' | 'blocked'
  -- 'match'  rows: 'match' | 'no_match' | 'no_face_detected'
  -- App-level enum; no DB CHECK because the valid set differs by kind.
  decision TEXT NOT NULL,

  -- 0..100 score. For 'safety' it is overallRiskScore; for 'match' it is
  -- confidence * 100, so a single column serves both kinds.
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),

  -- Full structured Claude response.
  --   safety: { overallRiskScore, summary, containsPerson,
  --             isProfilePhotoSuitable, recommendedAction, categories: [...] }
  --   match:  { match, confidence, reasoning }
  result JSONB NOT NULL,

  model TEXT NOT NULL,        -- e.g. 'claude-sonnet-4-6'
  tokens_in INTEGER,
  tokens_out INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE photo_verification_checks ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit rows. All writes happen via service-role
-- from the moderate-photo edge function; no INSERT/UPDATE policies for
-- clients.
CREATE POLICY photo_verification_checks_select_own ON photo_verification_checks
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pvc_user_created
  ON photo_verification_checks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvc_user_kind
  ON photo_verification_checks(user_id, kind, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. profiles columns
-- -----------------------------------------------------------------------------
-- Existing User.verified_at?: string in mobile/src/lib/types.ts is dead
-- code; the new verification_completed_at is the canonical timestamp.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_selfie_path TEXT;

-- Partial index: only the rows we'll actually query against.
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status
  ON profiles(verification_status)
  WHERE verification_status IN ('pending_review', 'rejected');

-- -----------------------------------------------------------------------------
-- 3. PostgREST schema cache reload
-- -----------------------------------------------------------------------------
-- Required because new columns are exposed via PostgREST. Without this,
-- callers can hit "column does not exist" until the next automatic reload.

SELECT pg_notify('pgrst', 'reload schema');
