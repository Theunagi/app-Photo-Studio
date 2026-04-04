-- Atomic credit provisioning function (prevents race conditions)
-- Called by service_role only (webhook / edge functions)
CREATE OR REPLACE FUNCTION provision_credits_atomic(
  p_user_id uuid,
  p_plan text,
  p_credits integer,
  p_is_upgrade boolean,
  p_stripe_customer_id text DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL
) RETURNS TABLE(new_balance integer, previous_balance integer, previous_plan text) AS $$
DECLARE
  v_prev_balance integer;
  v_prev_plan text;
  v_new_balance integer;
BEGIN
  -- Lock the row to prevent concurrent updates
  SELECT points_balance, plan INTO v_prev_balance, v_prev_plan
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found: %', p_user_id;
  END IF;

  -- Calculate new balance: upgrade adds to existing, renewal resets
  IF p_is_upgrade THEN
    v_new_balance := v_prev_balance + p_credits;
  ELSE
    v_new_balance := p_credits;
  END IF;

  -- Atomic update with row lock held
  UPDATE user_profiles SET
    points_balance = v_new_balance,
    plan = p_plan,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    current_period_end = COALESCE(p_period_end, current_period_end)
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_new_balance, v_prev_balance, v_prev_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role can call this
REVOKE ALL ON FUNCTION provision_credits_atomic FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION provision_credits_atomic TO service_role;
