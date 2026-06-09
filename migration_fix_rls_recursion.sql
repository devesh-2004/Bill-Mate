-- ==============================================================================
-- FIX: "infinite recursion detected in policy for relation workspace_members"
-- ------------------------------------------------------------------------------
-- Cause: RLS policies on workspace_members query workspace_members inside their
--        own USING/WITH CHECK clause. Postgres re-applies the same policy to that
--        subquery → infinite recursion (hit when creating an org).
--
-- Fix:   do membership/role checks inside SECURITY DEFINER functions (which run
--        as the table owner and bypass RLS), and drop EVERY existing policy on
--        workspace_members + workspaces before recreating only safe ones. The
--        dynamic drop guarantees no stale/duplicate recursive policy survives.
--
-- Idempotent & transactional. Run in the Supabase SQL Editor, then run the
-- verification query at the bottom.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINER helpers (RLS-bypassing checks)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace_id AND user_id = p_user_id
        AND role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = p_workspace_id AND owner_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 2. Drop EVERY existing policy on workspace_members and workspaces
-- ------------------------------------------------------------------------------

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('workspace_members', 'workspaces')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Recreate safe, non-recursive policies
-- ------------------------------------------------------------------------------

-- workspace_members ----------------------------------------------------------
-- SELECT: see members of any workspace you belong to.
CREATE POLICY "wm_select" ON public.workspace_members
  FOR SELECT USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- INSERT: admins/owners add members; a user may add THEMSELVES (org bootstrap /
-- accepting an invite) even before any membership row exists for them.
CREATE POLICY "wm_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

-- UPDATE: admins/owners change roles.
CREATE POLICY "wm_update" ON public.workspace_members
  FOR UPDATE USING ( public.is_workspace_admin(workspace_id, auth.uid()) );

-- DELETE: admins/owners remove members; a user may remove themselves (leave).
CREATE POLICY "wm_delete" ON public.workspace_members
  FOR DELETE USING (
    auth.uid() = user_id
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

-- workspaces -----------------------------------------------------------------
-- SELECT: members can view their workspaces.
CREATE POLICY "ws_select" ON public.workspaces
  FOR SELECT USING ( public.is_workspace_member(id, auth.uid()) );

-- INSERT: any authenticated user can create a workspace they own.
CREATE POLICY "ws_insert" ON public.workspaces
  FOR INSERT WITH CHECK ( auth.uid() = owner_id );

-- UPDATE: only the owner can update the workspace.
CREATE POLICY "ws_update" ON public.workspaces
  FOR UPDATE USING ( auth.uid() = owner_id );

-- DELETE: only the owner can delete the workspace.
CREATE POLICY "ws_delete" ON public.workspaces
  FOR DELETE USING ( auth.uid() = owner_id );

-- Make sure RLS is actually enabled (no-op if already on).
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- VERIFY (run this SELECT after the migration — every workspace_members policy
-- should reference a function, NOT "FROM workspace_members"):
--
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('workspace_members','workspaces')
--   ORDER BY tablename, policyname;
-- ==============================================================================
