-- ============================================================
-- Server-side atomic credit deduction + refund
-- ============================================================
-- FIX (security): credits were only ever deducted client-side
-- (deduct_my_points, called from the browser AFTER a generation).
-- The studio-api edge function merely *read* the balance, so an
-- authenticated user could call the edge function directly and never
-- run the client deduction → unlimited paid AI generations for free.
--
-- These functions let the edge function (service_role) deduct BEFORE
-- the paid API call and refund if it fails. They are the ONLY code
-- that decrements/increments points_balance server-side, and they are
-- callable exclusively by service_role — never by the browser.
--
-- The prevent_sensitive_profile_updates trigger (migration 006) already
-- allows service_role to write points_balance, so these UPDATEs pass.
-- ============================================================

-- Deduct: lock row, verify balance, decrement. Raises on insufficient funds.
CREATE OR REPLACE FUNCTION deduct_user_points(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be greater than 0';
  END IF;

  -- Lock the row to prevent concurrent double-spend
  SELECT points_balance INTO current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', current_balance, p_amount;
  END IF;

  new_balance := current_balance - p_amount;

  UPDATE user_profiles
  SET points_balance = new_balance
  WHERE id = p_user_id;

  RETURN new_balance;
END;
$$;

-- Refund: lock row, increment. Used when a paid action fails after deduction.
CREATE OR REPLACE FUNCTION refund_user_points(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount: must be greater than 0';
  END IF;

  SELECT points_balance INTO current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  new_balance := current_balance + p_amount;

  UPDATE user_profiles
  SET points_balance = new_balance
  WHERE id = p_user_id;

  RETURN new_balance;
END;
$$;

-- Only service_role (edge functions) may call these — never anon/authenticated.
REVOKE ALL ON FUNCTION deduct_user_points(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refund_user_points(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION deduct_user_points(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION refund_user_points(uuid, integer) TO service_role;
