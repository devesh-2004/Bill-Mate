-- ============================================================================
-- BillMate — In-app Notification System (idempotent)
--
-- The notifications table already ships in setup_fresh.sql; this migration is a
-- safe, standalone version for environments that predate it. Running it on an
-- up-to-date database is a no-op (every statement is guarded by IF NOT EXISTS /
-- pg_* lookups). Column names intentionally match the existing schema
-- (read / body) — do NOT rename to is_read / message.
-- ============================================================================

BEGIN;

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULL = broadcast to all members
  type         text NOT NULL DEFAULT 'info',
  title        text NOT NULL,
  body         text,
  link         text,
  entity_type  text,
  entity_id    text,
  read         boolean NOT NULL DEFAULT false,
  read_at      timestamptz,
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON public.notifications (workspace_id, user_id, read, created_at DESC);

-- 2. Row Level Security ------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_select') THEN
    CREATE POLICY "notif_select" ON public.notifications FOR SELECT
      USING ( public.is_workspace_member(workspace_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()) );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_update') THEN
    CREATE POLICY "notif_update" ON public.notifications FOR UPDATE
      USING ( public.is_workspace_member(workspace_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()) );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_insert') THEN
    CREATE POLICY "notif_insert" ON public.notifications FOR INSERT
      WITH CHECK ( public.is_workspace_member(workspace_id, auth.uid()) );
  END IF;
END $$;

-- 3. Realtime publication (powers the live bell) -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found; skipping (enable Realtime in the Supabase dashboard).';
END $$;

COMMIT;
