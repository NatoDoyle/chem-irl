-- Migration: Proposal Confirmation Race Condition Fix
-- Migrated from: db/proposal_confirmation_fix.sql
-- Order: 8 of 12
-- Description: Adds unique constraint and transactional RPC for proposal confirmation

-- Proposal Confirmation Race Condition Fix
-- This migration adds a unique constraint on confirms.proposal_id and creates
-- a transactional RPC function to handle proposal confirmation atomically.

-- ============================================================================
-- Step 1: Add unique constraint to prevents multiple confirms per proposal
-- ============================================================================
-- Only one confirm per proposal is allowed (first confirm wins)
ALTER TABLE confirms
ADD CONSTRAINT IF NOT EXISTS confirms_proposal_id_unique UNIQUE (proposal_id);

-- ============================================================================
-- Step 2: Create RPC function for atomic proposal confirmation
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_proposal(
  p_proposal_id UUID,
  p_match_id UUID,
  p_confirmer_id UUID,
  p_chosen_window JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_existing_confirm RECORD;
  v_confirm_id UUID;
  v_result JSONB;
BEGIN
  -- SECURITY: Verify caller is the confirmer
  IF auth.uid() IS NULL OR auth.uid() != p_confirmer_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the confirmer (user_id: %)', p_confirmer_id;
  END IF;

  -- Lock proposal row to prevent concurrent modifications
  SELECT * INTO v_proposal
  FROM proposals
  WHERE proposal_id = p_proposal_id
  FOR UPDATE;

  -- Check if proposal exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
  END IF;

  -- Check if proposal belongs to the specified match
  IF v_proposal.match_id != p_match_id THEN
    RAISE EXCEPTION 'Proposal % does not belong to match %', p_proposal_id, p_match_id;
  END IF;

  -- Check if proposal is already confirmed
  IF v_proposal.status = 'confirmed' THEN
    -- Return existing confirm record
    SELECT * INTO v_existing_confirm
    FROM confirms
    WHERE proposal_id = p_proposal_id;

    RETURN jsonb_build_object(
      'success', false,
      'already_confirmed', true,
      'confirm_id', v_existing_confirm.confirm_id,
      'chosen_window', v_existing_confirm.chosen_window,
      'confirmer_id', v_existing_confirm.confirmer_id,
      'created_at', v_existing_confirm.created_at
    );
  END IF;

  -- Check if proposal has expired
  IF v_proposal.expires_at < NOW() THEN
    RAISE EXCEPTION 'Proposal has expired: %', p_proposal_id;
  END IF;

  -- Validate chosen_window is one of the proposal's windows
  -- Check if chosen_window matches any window in the proposals.windows array
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_proposal.windows) AS window_elem
    WHERE window_elem->>'start' = p_chosen_window->>'start'
      AND window_elem->>'end' = p_chosen_window->>'end'
  ) THEN
    RAISE EXCEPTION 'Chosen window is not one of the proposal windows';
  END IF;

  -- Check if confirm already exists (race condition check)
  SELECT * INTO v_existing_confirm
  FROM confirms
  WHERE proposal_id = p_proposal_id
  FOR UPDATE;

  IF FOUND THEN
    -- Another transaction confirmed it first
    -- Update proposal status if not already updated
    UPDATE proposals
    SET status = 'confirmed'
    WHERE proposal_id = p_proposal_id AND status != 'confirmed';

    RETURN jsonb_build_object(
      'success', false,
      'already_confirmed', true,
      'confirm_id', v_existing_confirm.confirm_id,
      'chosen_window', v_existing_confirm.chosen_window,
      'confirmer_id', v_existing_confirm.confirmer_id,
      'created_at', v_existing_confirm.created_at
    );
  END IF;

  -- Insert confirm record (unique constraint will prevent duplicates if race occurs)
  INSERT INTO confirms (proposal_id, match_id, confirmer_id, chosen_window)
  VALUES (p_proposal_id, p_match_id, p_confirmer_id, p_chosen_window)
  ON CONFLICT (proposal_id) DO NOTHING
  RETURNING confirm_id INTO v_confirm_id;

  -- If conflict occurred (another transaction inserted first), return existing
  IF v_confirm_id IS NULL THEN
    SELECT * INTO v_existing_confirm
    FROM confirms
    WHERE proposal_id = p_proposal_id;

    UPDATE proposals
    SET status = 'confirmed'
    WHERE proposal_id = p_proposal_id AND status != 'confirmed';

    RETURN jsonb_build_object(
      'success', false,
      'already_confirmed', true,
      'confirm_id', v_existing_confirm.confirm_id,
      'chosen_window', v_existing_confirm.chosen_window,
      'confirmer_id', v_existing_confirm.confirmer_id,
      'created_at', v_existing_confirm.created_at
    );
  END IF;

  -- Update proposal status atomically
  UPDATE proposals
  SET status = 'confirmed'
  WHERE proposal_id = p_proposal_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'confirm_id', v_confirm_id,
    'chosen_window', p_chosen_window,
    'confirmer_id', p_confirmer_id,
    'created_at', NOW()
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION confirm_proposal(UUID, UUID, UUID, JSONB) TO authenticated;

