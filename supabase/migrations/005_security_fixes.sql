-- ============================================================
-- Security Fixes Migration (005)
-- Addresses CRITICAL + HIGH vulnerabilities from audit
-- ============================================================

-- ============================================================
-- 1. CRITICAL: Restrict user_profiles UPDATE to non-sensitive columns
-- Previously: users could update points_balance and plan via browser console.
-- Now: users can only update display_name and avatar_url.
-- points_balance, plan, stripe_customer_id are protected (service_role only).
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own non-sensitive profile fields"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- The row must belong to the user
    auth.uid() = id
  );

-- Since Postgres RLS can't restrict columns directly in policies,
-- we use a BEFORE UPDATE trigger to block sensitive column changes.
CREATE OR REPLACE FUNCTION prevent_sensitive_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the caller is NOT service_role (i.e., it's a regular user via anon/authenticated),
  -- prevent changes to sensitive columns.
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    -- Block points_balance changes
    IF NEW.points_balance IS DISTINCT FROM OLD.points_balance THEN
      RAISE EXCEPTION 'Cannot modify points_balance directly. Use the API.';
    END IF;
    -- Block plan changes
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Cannot modify plan directly. Use the subscription system.';
    END IF;
    -- Block stripe_customer_id changes
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'Cannot modify stripe_customer_id directly.';
    END IF;
    -- Block current_period_end changes
    IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
      RAISE EXCEPTION 'Cannot modify current_period_end directly.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sensitive_profile_updates ON user_profiles;
CREATE TRIGGER trg_prevent_sensitive_profile_updates
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_sensitive_profile_updates();

-- ============================================================
-- 2. CRITICAL: Validate amount > 0 in deduct_my_points
-- Prevents negative deductions (which would ADD credits).
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_my_points(amount_input integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user uuid;
  current_balance integer;
  new_balance integer;
BEGIN
  calling_user := auth.uid();
  IF calling_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- SECURITY: Reject zero or negative amounts
  IF amount_input <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be greater than 0';
  END IF;

  -- Lock the row to prevent race conditions
  SELECT points_balance INTO current_balance
  FROM user_profiles
  WHERE id = calling_user
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
  WHERE id = calling_user;

  RETURN new_balance;
END;
$$;

-- ============================================================
-- 3. HIGH: Add webhook_events table for idempotency
-- Prevents duplicate processing of Stripe webhook events.
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    text PRIMARY KEY,
  event_type  text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-cleanup: events older than 7 days (Stripe retries for max 3 days)
-- Run this periodically or via pg_cron if available
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON webhook_events (processed_at);

-- RLS: Only service_role should access this table
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can read/write (exactly what we want)
