-- Drop redundant duplicate SELECT policies (subsumed by the new combined policy)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

-- Allow users to view their own profile AND profiles of users they have an open match with
CREATE POLICY "Users can view own and matched profiles"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.status = 'open'
      AND (
        (matches.user_a = auth.uid() AND matches.user_b = profiles.id)
        OR (matches.user_b = auth.uid() AND matches.user_a = profiles.id)
      )
    )
  );
