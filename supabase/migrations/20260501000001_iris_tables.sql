-- ============================================================================
-- Migration: Iris concierge — conversation, message, memory tables
-- Created:   2026-05-01
-- ============================================================================
-- Foundational tables for the Iris AI concierge feature. Purely additive — no
-- existing tables are modified. All writes happen via service-role from the
-- iris-chat edge function; clients only have SELECT-on-own-rows visibility.
--
-- See: /Users/nathandoyle/.claude/plans/the-whole-premise-behind-purring-blossom.md
-- ============================================================================

-- ============================================================================
-- STEP 1: iris_conversations — one row per conversation session per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS iris_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  match_id UUID REFERENCES matches(match_id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  turn_count INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);

ALTER TABLE iris_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY iris_conversations_select_own ON iris_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_iris_conv_user ON iris_conversations(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_iris_conv_match ON iris_conversations(match_id) WHERE match_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iris_conv_active ON iris_conversations(user_id, status) WHERE status = 'active';

-- ============================================================================
-- STEP 2: iris_messages — append-only log of turns within each conversation
-- ============================================================================

CREATE TABLE IF NOT EXISTS iris_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES iris_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content JSONB NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE iris_messages ENABLE ROW LEVEL SECURITY;

-- A user can read messages whose parent conversation belongs to them.
CREATE POLICY iris_messages_select_own ON iris_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM iris_conversations c
      WHERE c.id = iris_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_iris_msg_conversation ON iris_messages(conversation_id, created_at);

-- ============================================================================
-- STEP 3: iris_memory — one row per user; canonical Iris knowledge of them
-- ============================================================================
-- `facts` is a structured blob the AI extraction pass writes to at session end.
-- Shape is intentionally untyped at the DB level (`version` lets us evolve the
-- shape without migration churn). v1 shape:
--   {
--     consent: { interview: bool, chat_coach: bool, date_organiser: bool },
--     values:  [{ label, evidence_turn_id }],
--     date_preferences: { settings: [...], avoids: [...], time_of_day: [...] },
--     stories: [{ title, gist, evidence_turn_id }],
--     tone: { texting_style, sentence_length, emoji, ... }
--   }
-- `ocean_scores` shape:
--   { O: { score, confidence }, C: {...}, E: {...}, A: {...}, N: {...} }
-- where score ∈ [0, 1] and confidence ∈ [0, 1].

CREATE TABLE IF NOT EXISTS iris_memory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocean_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  interview_completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE iris_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY iris_memory_select_own ON iris_memory
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies for client roles. Writes happen through
-- iris_apply_memory_patch (SECURITY DEFINER) called from the iris-chat edge
-- function via service-role.
