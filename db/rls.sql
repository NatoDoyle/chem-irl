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




