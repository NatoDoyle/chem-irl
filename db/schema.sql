-- Chem IRL Database Schema
-- Based on Functional Spec v3 and Data Pack v1

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_gender AS ENUM ('male', 'female', 'non_binary', 'other');
CREATE TYPE user_orientation AS ENUM ('straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'other');
CREATE TYPE match_status AS ENUM ('open', 'expired', 'closed', 'unmatched');
CREATE TYPE proposal_status AS ENUM ('active', 'expired', 'confirmed', 'reopened');
CREATE TYPE report_category AS ENUM ('spam_scam', 'fake_impersonation', 'harassment_hate', 'threat_coercion', 'nudity', 'minor', 'off_platform_solicitation', 'other');
CREATE TYPE enforcement_action AS ENUM ('warning', 'content_removal', 'temporary_ban', 'permanent_ban', 'device_ban');
CREATE TYPE purchase_type AS ENUM ('credits', 'subscription', 'bond');
CREATE TYPE credit_feature AS ENUM ('reopen', 'fast_pass', 'extra_chat', 'stack_pass');

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  dob DATE NOT NULL,
  gender user_gender NOT NULL,
  orientation user_orientation NOT NULL,
  city_id TEXT NOT NULL DEFAULT 'dublin',
  timezone TEXT NOT NULL DEFAULT 'Europe/Dublin',
  verified_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  prompts JSONB DEFAULT '{}',
  availability JSONB DEFAULT '{}',
  photos JSONB DEFAULT '[]',
  completion_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  like_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  likee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liker_id, likee_id)
);

-- Matches table
CREATE TABLE matches (
  match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status match_status DEFAULT 'open',
  UNIQUE(user_a, user_b)
);

-- Proposals table
CREATE TABLE proposals (
  proposal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  windows JSONB NOT NULL, -- Array of {start, end} time windows
  date_types JSONB NOT NULL, -- Array of date type strings
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status proposal_status DEFAULT 'active'
);

-- Confirms table
CREATE TABLE confirms (
  confirm_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(proposal_id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  confirmer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  chosen_window JSONB NOT NULL, -- The selected time window
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Surveys table
CREATE TABLE surveys (
  survey_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  went BOOLEAN NOT NULL,
  would_meet_again BOOLEAN,
  vibe INTEGER CHECK (vibe >= 1 AND vibe <= 5),
  safety INTEGER CHECK (safety >= 1 AND safety <= 5),
  on_time_min INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Daily scores table
CREATE TABLE scores_daily (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  day DATE NOT NULL,
  action_speed INTEGER NOT NULL DEFAULT 50 CHECK (action_speed >= 0 AND action_speed <= 100),
  profile_quality INTEGER NOT NULL DEFAULT 50 CHECK (profile_quality >= 0 AND profile_quality <= 100),
  reliability INTEGER NOT NULL DEFAULT 70 CHECK (reliability >= 0 AND reliability <= 100),
  report_risk NUMERIC NOT NULL DEFAULT 0 CHECK (report_risk >= 0 AND report_risk <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

-- Purchases table
CREATE TABLE purchases (
  purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type purchase_type NOT NULL,
  amount_eur NUMERIC NOT NULL,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  refunded BOOLEAN DEFAULT FALSE
);

-- Credits ledger table
CREATE TABLE credits_ledger (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  delta INTEGER NOT NULL, -- Positive for credits added, negative for spent
  feature credit_feature,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
  case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  accused_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category report_category NOT NULL,
  description TEXT,
  evidence JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  sla_deadline TIMESTAMPTZ NOT NULL
);

-- Enforcements table
CREATE TABLE enforcements (
  action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES reports(case_id) ON DELETE CASCADE,
  accused_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  action enforcement_action NOT NULL,
  ttl_days INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_likes_liker_id ON likes(liker_id);
CREATE INDEX idx_likes_likee_id ON likes(likee_id);
CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_proposals_match_id ON proposals(match_id);
CREATE INDEX idx_proposals_sender_id ON proposals(sender_id);
CREATE INDEX idx_proposals_expires_at ON proposals(expires_at);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_confirms_match_id ON confirms(match_id);
CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_surveys_match_id ON surveys(match_id);
CREATE INDEX idx_scores_daily_user_id ON scores_daily(user_id);
CREATE INDEX idx_scores_daily_day ON scores_daily(day);
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_credits_ledger_user_id ON credits_ledger(user_id);
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_accused_id ON reports(accused_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_enforcements_accused_id ON enforcements(accused_id);

-- Create GIN indexes for JSONB columns
CREATE INDEX idx_profiles_prompts ON profiles USING GIN (prompts);
CREATE INDEX idx_profiles_availability ON profiles USING GIN (availability);
CREATE INDEX idx_profiles_photos ON profiles USING GIN (photos);
CREATE INDEX idx_proposals_windows ON proposals USING GIN (windows);
CREATE INDEX idx_proposals_date_types ON proposals USING GIN (date_types);
CREATE INDEX idx_confirms_chosen_window ON confirms USING GIN (chosen_window);
CREATE INDEX idx_reports_evidence ON reports USING GIN (evidence);




