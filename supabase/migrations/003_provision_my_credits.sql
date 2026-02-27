-- ============================================================
-- Secure credit provisioning RPC (uses auth.uid() — no user_id parameter)
-- Called from frontend after RevenueCat purchase completes.
-- ============================================================

CREATE OR REPLACE FUNCTION provision_my_credits(
  credits_input integer,
  plan_input text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
  calling_user uuid;
BEGIN
  calling_user := auth.uid();
  IF calling_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_profiles
  SET
    points_balance = credits_input,
    plan = plan_input
  WHERE id = calling_user
  RETURNING points_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN new_balance;
END;
$$;
