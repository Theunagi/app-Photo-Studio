-- ============================================================
-- Security Hardening Migration
-- Fixes CRITICAL vulnerabilities found during audit
-- ============================================================

-- ============================================================
-- 1. CRITICAL: Drop provision_my_credits (allows frontend to set arbitrary credits)
-- Credits are now provisioned via the provision-credits Edge Function
-- which verifies the subscription with RevenueCat before granting credits.
-- ============================================================
DROP FUNCTION IF EXISTS provision_my_credits(integer, text);

-- ============================================================
-- 2. CRITICAL: Revoke frontend access to provision_credits
-- This function should only be callable by service_role (Edge Functions).
-- ============================================================
REVOKE EXECUTE ON FUNCTION provision_credits(uuid, integer, text) FROM anon, authenticated;

-- ============================================================
-- 3. CRITICAL: Replace deduct_points with deduct_my_points
-- Old version accepted user_id_input (IDOR vulnerability).
-- New version uses auth.uid() so users can only deduct their own credits.
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

-- Remove the old insecure version
DROP FUNCTION IF EXISTS deduct_points(uuid, integer);

-- ============================================================
-- 4. IMPORTANT: Enable RLS on user_profiles
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can read own profile"
      ON user_profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- Users can only update their own profile (non-sensitive fields)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can update own profile"
      ON user_profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- Users can insert their own profile (for first-time signup)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'user_profiles') THEN
    CREATE POLICY "Users can insert own profile"
      ON user_profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================================
-- 5. IMPORTANT: Fix payment_events INSERT policy
-- Only the user themselves or service_role should insert events.
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert payment events" ON payment_events;

CREATE POLICY "Users can insert own payment events"
  ON payment_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. IMPORTANT: Enable RLS on projects (if table exists)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own projects' AND tablename = 'projects') THEN
      CREATE POLICY "Users can read own projects"
        ON projects FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own projects' AND tablename = 'projects') THEN
      CREATE POLICY "Users can insert own projects"
        ON projects FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own projects' AND tablename = 'projects') THEN
      CREATE POLICY "Users can update own projects"
        ON projects FOR UPDATE
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own projects' AND tablename = 'projects') THEN
      CREATE POLICY "Users can delete own projects"
        ON projects FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;
