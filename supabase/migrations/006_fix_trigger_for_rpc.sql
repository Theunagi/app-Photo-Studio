-- ============================================================
-- Fix: Allow deduct_my_points RPC to update points_balance
-- The trigger from 005 blocks ALL non-service_role updates,
-- but deduct_my_points runs as authenticated user via PostgREST.
-- Solution: Use a session-local variable as a trusted-function flag.
-- ============================================================

-- 1. Update deduct_my_points to set a trusted flag before UPDATE
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

  -- Set trusted-function flag so the trigger allows this update
  PERFORM set_config('app.trusted_function', 'deduct_my_points', true);

  UPDATE user_profiles
  SET points_balance = new_balance
  WHERE id = calling_user;

  -- Clear the flag immediately after
  PERFORM set_config('app.trusted_function', '', true);

  RETURN new_balance;
END;
$$;

-- 2. Update trigger to respect the trusted-function flag
CREATE OR REPLACE FUNCTION prevent_sensitive_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow service_role to do anything
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow trusted RPC functions (set_config is transaction-local, not settable via REST)
  IF current_setting('app.trusted_function', true) = 'deduct_my_points' THEN
    -- Extra validation: only points_balance should change, and only decrease
    IF NEW.points_balance >= OLD.points_balance THEN
      RAISE EXCEPTION 'Trusted function tried to increase points_balance';
    END IF;
    -- Ensure no other sensitive fields changed
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Trusted function cannot modify plan';
    END IF;
    IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
      RAISE EXCEPTION 'Trusted function cannot modify stripe_customer_id';
    END IF;
    IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
      RAISE EXCEPTION 'Trusted function cannot modify current_period_end';
    END IF;
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$$;
