-- Remove the problematic view that causes "is not a table" errors
-- This migration cleans up any existing view and policies

-- Drop the policy first (if exists)
DROP POLICY IF EXISTS "Admin can view auth status" ON public.v_users_auth_status;
DROP POLICY IF EXISTS "Admin can view user auth status" ON public.v_users_auth_status;

-- Drop the view (if exists)
DROP VIEW IF EXISTS public.v_users_auth_status;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_users_auth_status();

-- Add a comment for future reference
COMMENT ON SCHEMA public IS '
Note: v_users_auth_status view was removed due to RLS compatibility issues.
The password setup functionality now uses direct queries to the users table.
';