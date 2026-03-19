-- ============================================================
-- FrameFlow — Payment & Subscription Schema
-- Run after schema.sql (001)
-- ============================================================

-- ============================================================
-- 1. Ensure user_profiles table has payment fields
-- ============================================================
-- The table may already exist from initial setup. Add columns if missing.

DO $$
BEGIN
  -- Add stripe_customer_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  -- Add current_period_end if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_period_end'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_period_end timestamptz;
  END IF;

  -- Add plan if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN plan text NOT NULL DEFAULT 'free';
  END IF;

  -- Add points_balance if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'points_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN points_balance integer NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Index for webhook lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer
  ON user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 2. Payment events log table (for audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for querying events by user
CREATE INDEX IF NOT EXISTS idx_payment_events_user
  ON payment_events (user_id, created_at DESC);

-- RLS: Users can read their own events, service role can insert
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment events"
  ON payment_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert payment events"
  ON payment_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 3. Atomic point deduction RPC (if not exists)
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_points(user_id_input uuid, amount_input integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT points_balance INTO current_balance
  FROM user_profiles
  WHERE id = user_id_input
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF current_balance < amount_input THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', current_balance, amount_input;
  END IF;

  new_balance := current_balance - amount_input;

  UPDATE user_profiles
  SET points_balance = new_balance
  WHERE id = user_id_input;

  RETURN new_balance;
END;
$$;

-- ============================================================
-- 4. Credit provisioning RPC (called by webhook)
-- ============================================================
CREATE OR REPLACE FUNCTION provision_credits(
  user_id_input uuid,
  credits_input integer,
  plan_input text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE user_profiles
  SET
    points_balance = credits_input,
    plan = plan_input
  WHERE id = user_id_input
  RETURNING points_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found for ID %', user_id_input;
  END IF;

  RETURN new_balance;
END;
$$;

-- ============================================================
-- 5. RPC to refresh profile after purchase (called from frontend)
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', id,
    'points_balance', points_balance,
    'plan', plan,
    'stripe_customer_id', stripe_customer_id,
    'current_period_end', current_period_end
  ) INTO result
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN result;
END;
$$;
