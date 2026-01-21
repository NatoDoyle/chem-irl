-- Migration: Row Level Security Policies
-- Migrated from: db/rls.sql
-- Order: 2 of 12
-- Description: Enables RLS and creates security policies for all tables

-- Row Level Security Policies for Chem IRL
-- Based on Security Pack v1 and Functional Spec v3

-- Drop existing policies if they exist (allows re-running this script)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcements ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = user_id);

-- Profiles table policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Likes table policies
CREATE POLICY "Users can view own likes" ON likes
  FOR SELECT USING (auth.uid() = liker_id OR auth.uid() = likee_id);

CREATE POLICY "Users can insert own likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = liker_id);

CREATE POLICY "Users can delete own likes" ON likes
  FOR DELETE USING (auth.uid() = liker_id);

-- Matches table policies
CREATE POLICY "Users can view own matches" ON matches
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "System can insert matches" ON matches
  FOR INSERT WITH CHECK (true); -- Handled by application logic

-- Proposals table policies
CREATE POLICY "Users can view proposals in their matches" ON proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = proposals.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can insert proposals in their matches" ON proposals
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = proposals.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can update proposals they sent" ON proposals
  FOR UPDATE USING (auth.uid() = sender_id);

-- Confirms table policies
CREATE POLICY "Users can view confirms in their matches" ON confirms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = confirms.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can insert confirms in their matches" ON confirms
  FOR INSERT WITH CHECK (
    auth.uid() = confirmer_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = confirms.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

-- Messages table policies
CREATE POLICY "Users can view messages in their matches" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their matches" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = messages.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

-- Surveys table policies
CREATE POLICY "Users can view surveys in their matches" ON surveys
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = surveys.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can insert surveys in their matches" ON surveys
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = surveys.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "Users can update own surveys" ON surveys
  FOR UPDATE USING (auth.uid() = user_id);

-- Scores daily table policies
CREATE POLICY "Users can view own scores" ON scores_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage scores" ON scores_daily
  FOR ALL USING (true); -- Handled by application logic

-- Purchases table policies
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credits ledger table policies
CREATE POLICY "Users can view own credits" ON credits_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage credits" ON credits_ledger
  FOR ALL USING (true); -- Handled by application logic

-- Reports table policies
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id OR auth.uid() = accused_id);

CREATE POLICY "Users can insert reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Moderators can view all reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  );

-- Enforcements table policies
CREATE POLICY "Users can view own enforcements" ON enforcements
  FOR SELECT USING (auth.uid() = accused_id);

CREATE POLICY "Moderators can manage enforcements" ON enforcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    )
  );

-- Create functions for common operations
CREATE OR REPLACE FUNCTION get_user_matches(user_uuid UUID)
RETURNS TABLE(match_id UUID, other_user_id UUID, other_user_email TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.match_id,
    CASE 
      WHEN m.user_a = user_uuid THEN m.user_b 
      ELSE m.user_a 
    END as other_user_id,
    CASE 
      WHEN m.user_a = user_uuid THEN u_b.email 
      ELSE u_a.email 
    END as other_user_email,
    m.created_at
  FROM matches m
  LEFT JOIN users u_a ON m.user_a = u_a.user_id
  LEFT JOIN users u_b ON m.user_b = u_b.user_id
  WHERE (m.user_a = user_uuid OR m.user_b = user_uuid)
    AND m.status = 'open';
$$;

-- Create function to check if users are matched
CREATE OR REPLACE FUNCTION are_users_matched(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches 
    WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
      AND status = 'open'
  );
$$;

-- Create function to get user's current action speed score
CREATE OR REPLACE FUNCTION get_user_action_speed(user_uuid UUID)
RETURNS INTEGER
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT action_speed FROM scores_daily 
     WHERE user_id = user_uuid 
     ORDER BY day DESC LIMIT 1),
    50
  );
$$;

-- Discovery feed helper (security definer ensures feed access while respecting business rules)
CREATE OR REPLACE FUNCTION get_discovery_feed(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
  bio TEXT,
  availability_summary TEXT,
  action_speed INTEGER,
  profile_quality INTEGER,
  reliability INTEGER
)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    COALESCE(p.prompts ->> 'headline', '') AS headline,
    COALESCE(p.prompts ->> 'bio', '') AS bio,
    COALESCE(p.availability ->> 'summary', '') AS availability_summary,
    COALESCE(s.action_speed, 50) AS action_speed,
    COALESCE(s.profile_quality, 50) AS profile_quality,
    COALESCE(s.reliability, 70) AS reliability
  FROM profiles p
  LEFT JOIN scores_daily s ON s.user_id = p.user_id AND s.day = CURRENT_DATE
  WHERE p.user_id <> p_viewer
    AND p.completion_pct >= 80
    -- Exclude users already liked or matched
    AND NOT EXISTS (
      SELECT 1 FROM likes l 
      WHERE l.liker_id = p_viewer AND l.likee_id = p.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM matches m 
      WHERE (m.user_a = p_viewer AND m.user_b = p.user_id) 
         OR (m.user_a = p.user_id AND m.user_b = p_viewer)
      AND m.status = 'open'
    )
  ORDER BY
    COALESCE(s.action_speed, 50) DESC,
    COALESCE(s.profile_quality, 50) DESC,
    COALESCE(s.reliability, 70) DESC,
    p.updated_at DESC
  LIMIT p_limit;
$$;

-- Like and match detection function
CREATE OR REPLACE FUNCTION create_like_and_check_match(p_liker UUID, p_likee UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id UUID;
  v_mutual_like_exists BOOLEAN;
  v_match_id UUID;
  v_result JSONB;
BEGIN
  -- Insert like (ignore if duplicate due to UNIQUE constraint)
  INSERT INTO likes (liker_id, likee_id)
  VALUES (p_liker, p_likee)
  ON CONFLICT (liker_id, likee_id) DO NOTHING
  RETURNING like_id INTO v_like_id;

  -- If no like was inserted (duplicate), return existing state
  IF v_like_id IS NULL THEN
    SELECT like_id INTO v_like_id FROM likes WHERE liker_id = p_liker AND likee_id = p_likee;
    SELECT EXISTS (
      SELECT 1 FROM matches 
      WHERE ((user_a = p_liker AND user_b = p_likee) OR (user_a = p_likee AND user_b = p_liker))
        AND status = 'open'
    ) INTO v_mutual_like_exists;
    
    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', v_mutual_like_exists,
      'match_id', NULL
    );
  END IF;

  -- Check for mutual like
  SELECT EXISTS (
    SELECT 1 FROM likes 
    WHERE liker_id = p_likee AND likee_id = p_liker
  ) INTO v_mutual_like_exists;

  -- If mutual like, create match
  IF v_mutual_like_exists THEN
    INSERT INTO matches (user_a, user_b, status)
    VALUES (
      LEAST(p_liker, p_likee),
      GREATEST(p_liker, p_likee),
      'open'
    )
    ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'open'
    RETURNING match_id INTO v_match_id;

    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', true,
      'match_id', v_match_id
    );
  END IF;

  -- No match yet
  RETURN jsonb_build_object(
    'like_id', v_like_id,
    'matched', false,
    'match_id', NULL
  );
END;
$$;

