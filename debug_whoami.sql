-- ==============================================================================
-- TEMP DIAGNOSTIC: exposes what the database sees as the current user.
-- Run this in the Supabase SQL Editor, then retry creating an organization.
-- The onboarding error will print:  [debug: user.id=... db_auth_uid=...]
--
--   db_auth_uid = NULL          -> auth session isn't reaching the DB (auth-context bug)
--   db_auth_uid = same as user.id -> auth is fine; the policy/schema is the problem
--   db_auth_uid = different uuid -> token mismatch
--
-- Safe to drop afterwards:  DROP FUNCTION IF EXISTS public.whoami();
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.whoami()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$ SELECT auth.uid() $$;

GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
