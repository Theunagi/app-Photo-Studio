-- ============================================================
-- Migration: Security Fixes — 2026-03-20
-- Fixes: Dev bypass, RLS on projects, anonymous storage access
--
-- Run this in Supabase Dashboard > SQL Editor > New query
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Add user_id column to projects (if not already present)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'user_id'
  ) THEN
    -- Add column as nullable first (existing rows have no owner)
    ALTER TABLE projects ADD COLUMN user_id uuid;

    -- Backfill: assign existing projects to a default user
    -- Replace 'YOUR_USER_UUID_HERE' with your actual Supabase auth user ID.
    -- Find it in: Supabase Dashboard > Authentication > Users
    -- Example: UPDATE projects SET user_id = 'a1b2c3d4-...' WHERE user_id IS NULL;
    RAISE NOTICE '⚠️  ACTION REQUIRED: Run this after migration:';
    RAISE NOTICE '    UPDATE projects SET user_id = ''YOUR_USER_UUID'' WHERE user_id IS NULL;';
    RAISE NOTICE '    Then run: ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;';
  END IF;
END $$;

-- Index for filtering by owner
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);


-- ============================================================
-- 2. Replace "Allow all" RLS policy with per-user policies
-- ============================================================

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow all on projects" ON projects;

-- Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users read own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert projects they own
CREATE POLICY "Users insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own projects
CREATE POLICY "Users update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own projects
CREATE POLICY "Users delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- 3. Replace anonymous storage policies with authenticated ones
-- ============================================================

-- Drop old anonymous policies
DROP POLICY IF EXISTS "Anonymous upload" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous update" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous delete" ON storage.objects;

-- Keep public read access (product images are not sensitive)
-- Policy "Public read access" already exists — no change needed.

-- Authenticated users can upload to project-images
CREATE POLICY "Authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

-- Authenticated users can update files in project-images
CREATE POLICY "Authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-images' AND auth.role() = 'authenticated');

-- Authenticated users can delete files in project-images
CREATE POLICY "Authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-images' AND auth.role() = 'authenticated');


COMMIT;

-- ============================================================
-- POST-MIGRATION STEPS (run manually after this script):
--
-- 1. Find your user ID:
--    SELECT id, email FROM auth.users LIMIT 10;
--
-- 2. Assign your projects to yourself:
--    UPDATE projects SET user_id = 'YOUR_UUID' WHERE user_id IS NULL;
--
-- 3. Make user_id NOT NULL:
--    ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;
--
-- 4. Verify RLS is working:
--    SELECT * FROM projects;  -- Should only show your projects
--
-- 5. Deploy updated Edge Function:
--    supabase functions deploy studio-api
-- ============================================================
