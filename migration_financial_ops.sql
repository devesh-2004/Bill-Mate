-- ==============================================================================
-- BILLMATE — FINANCIAL OPERATIONS EXTENSION (TIER 5)
-- ------------------------------------------------------------------------------
-- Adds: Recurring Invoices, Expense Tracking, Notification Center,
--       Client Self-Service (disputes + messaging), Razorpay Payments,
--       Financial Forecasting (reuses ai_reports), Global Full-Text Search,
--       Developer API (keys + audit + rate-limit support).
--
-- Design principles:
--   * Reuses existing tables (invoices, payments, clients, ai_reports,
--     activity_logs) — no duplicate data models.
--   * Every tenant table is workspace-scoped with RLS mirroring existing
--     "Workspace members can access ..." policies.
--   * Fully idempotent & transactional — safe to re-run.
-- Run in the Supabase SQL Editor.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 0. SHARED HELPERS
-- ------------------------------------------------------------------------------

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Membership check helper (SECURITY DEFINER so it can be reused in policies/RPCs
-- without recursive RLS evaluation). Returns true if the user belongs to ws.
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns the caller's role in a workspace (or null).
CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid)
RETURNS text AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 1. RECURRING INVOICES
-- ==============================================================================
-- A schedule that the BullMQ worker materialises into real invoices.
-- Line items are stored inline as jsonb (it's a template, not a live invoice).

CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title text,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  interval_count int NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  -- invoice template fields
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ description, quantity, price }]
  currency text DEFAULT 'USD',
  tax_rate numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  notes text,
  terms text,
  due_days int NOT NULL DEFAULT 14,                -- due_date = issue_date + due_days
  auto_send boolean NOT NULL DEFAULT false,        -- create as 'Pending' vs 'Draft'
  -- scheduling
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,                                   -- null = no end
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  occurrences_generated int NOT NULL DEFAULT 0,
  max_occurrences int,                             -- null = unlimited
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Link generated invoices back to their schedule (reuse invoices table).
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_invoice_id uuid
  REFERENCES public.recurring_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_workspace ON public.recurring_invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_due ON public.recurring_invoices(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_invoices_recurring ON public.invoices(recurring_invoice_id);

DROP TRIGGER IF EXISTS trg_recurring_invoices_updated ON public.recurring_invoices;
CREATE TRIGGER trg_recurring_invoices_updated BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workspace members can access recurring invoices" ON public.recurring_invoices;
CREATE POLICY "Workspace members can access recurring invoices" ON public.recurring_invoices
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ==============================================================================
-- 2. EXPENSE TRACKING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,                 -- Supabase Storage path in the 'receipts' bucket
  status text DEFAULT 'recorded' CHECK (status IN ('recorded', 'reimbursed', 'pending')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON public.expenses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(workspace_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_categories_workspace ON public.expense_categories(workspace_id);

DROP TRIGGER IF EXISTS trg_expenses_updated ON public.expenses;
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can access expense categories" ON public.expense_categories;
CREATE POLICY "Workspace members can access expense categories" ON public.expense_categories
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can access expenses" ON public.expenses;
CREATE POLICY "Workspace members can access expenses" ON public.expenses
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Receipts storage bucket (private) + workspace-scoped storage policies.
-- Files are stored under: receipts/<workspace_id>/<expense_id>/<filename>
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Workspace members manage receipts" ON storage.objects;
CREATE POLICY "Workspace members manage receipts" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'receipts'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ==============================================================================
-- 3. NOTIFICATION CENTER
-- ==============================================================================
-- user_id NULL  => broadcast to all members of the workspace.
-- user_id SET   => targeted to a single member.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',  -- info | invoice | payment | expense | dispute | system
  title text NOT NULL,
  body text,
  link text,                          -- relative app path to deep-link to
  entity_type text,
  entity_id text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON public.notifications(workspace_id, user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Members can read broadcasts (user_id is null) or notifications addressed to them.
DROP POLICY IF EXISTS "Members read own notifications" ON public.notifications;
CREATE POLICY "Members read own notifications" ON public.notifications
  FOR SELECT USING (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Members can mark their own notifications read (UPDATE).
DROP POLICY IF EXISTS "Members update own notifications" ON public.notifications;
CREATE POLICY "Members update own notifications" ON public.notifications
  FOR UPDATE USING (
    public.is_workspace_member(workspace_id, auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Members can create notifications within their workspace (server actions);
-- system/worker inserts use the service role and bypass RLS.
DROP POLICY IF EXISTS "Members create notifications" ON public.notifications;
CREATE POLICY "Members create notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ==============================================================================
-- 4. CLIENT SELF-SERVICE PORTAL (disputes + messaging + billing profile)
-- ==============================================================================

-- 4a. Billing profile fields on the existing clients table (no new entity).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS razorpay_customer_id text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true;

-- 4b. Secure portal access tokens (passwordless client login).
CREATE TABLE IF NOT EXISTS public.client_portal_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  token_hash text NOT NULL UNIQUE,       -- sha256 of the magic token; raw token never stored
  email text,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_portal_access_client ON public.client_portal_access(client_id);

-- 4c. Disputes raised by a client against an invoice.
CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_disputes_workspace ON public.disputes(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON public.disputes(invoice_id);

DROP TRIGGER IF EXISTS trg_disputes_updated ON public.disputes;
CREATE TRIGGER trg_disputes_updated BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4d. Threaded messages between a client and the workspace.
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  dispute_id uuid REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client', 'workspace')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(workspace_id, client_id, created_at);

ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Members manage portal access tokens for their workspace.
DROP POLICY IF EXISTS "Workspace members manage portal access" ON public.client_portal_access;
CREATE POLICY "Workspace members manage portal access" ON public.client_portal_access
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Members manage disputes/messages in their workspace. The client side of the
-- portal authenticates via token and is served through the service role.
DROP POLICY IF EXISTS "Workspace members access disputes" ON public.disputes;
CREATE POLICY "Workspace members access disputes" ON public.disputes
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members access messages" ON public.messages;
CREATE POLICY "Workspace members access messages" ON public.messages
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ==============================================================================
-- 5. RAZORPAY PAYMENTS (extends existing payments + invoices)
-- ==============================================================================

-- Extend the existing payments table rather than create a parallel one.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'succeeded'
  CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'));
-- Dedupes the client-callback and webhook reconciliation paths.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_razorpay_payment
  ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Track the in-flight Razorpay order on the invoice for reconciliation.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_order
  ON public.invoices(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

-- Idempotency ledger for Razorpay webhook events (prevents double-processing).
-- Razorpay has no stable event id, so we store a derived "<event>:<payment_id>".
CREATE TABLE IF NOT EXISTS public.razorpay_events (
  id text PRIMARY KEY,
  type text,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  payload jsonb,
  processed_at timestamptz DEFAULT now() NOT NULL
);
-- No RLS-exposed policy: only the service role (webhook handler) touches this.
ALTER TABLE public.razorpay_events ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. FINANCIAL FORECASTING
-- ==============================================================================
-- Reuses ai_reports with report_type = 'forecast'. content jsonb holds:
--   { cashFlowPrediction, riskScore, riskLevel, recommendations[], generatedFor }
-- ai_reports already has workspace-scoped SELECT RLS. Add INSERT for members so
-- the "generate forecast" server action can persist results.
DROP POLICY IF EXISTS "Workspace members can insert AI reports" ON public.ai_reports;
CREATE POLICY "Workspace members can insert AI reports" ON public.ai_reports
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ==============================================================================
-- 7. GLOBAL FULL-TEXT SEARCH
-- ==============================================================================
-- Generated tsvector columns + GIN indexes on searchable tables, plus a single
-- workspace-scoped RPC returning a unified, ranked result set.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name, '') || ' ' || coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' || coalesce(billing_name, ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_clients_search ON public.clients USING gin(search_vector);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(invoice_number, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(status, ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_invoices_search ON public.invoices USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_notifications_search
  ON public.notifications USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,'')));
CREATE INDEX IF NOT EXISTS idx_activity_logs_search
  ON public.activity_logs USING gin(to_tsvector('simple', coalesce(action,'') || ' ' || coalesce(entity_type,'')));

-- Unified search RPC. SECURITY DEFINER but strictly enforces membership.
CREATE OR REPLACE FUNCTION public.search_workspace(p_workspace_id uuid, p_query text)
RETURNS TABLE (
  entity_type text,
  entity_id text,
  title text,
  subtitle text,
  rank real
) AS $$
DECLARE
  q tsquery;
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a workspace member';
  END IF;

  -- websearch_to_tsquery is forgiving of free-form user input
  q := websearch_to_tsquery('simple', coalesce(p_query, ''));
  IF q IS NULL OR p_query IS NULL OR length(trim(p_query)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'client'::text, c.id::text, c.name,
         coalesce(c.email, c.phone, ''), ts_rank(c.search_vector, q)
  FROM public.clients c
  WHERE c.workspace_id = p_workspace_id AND c.search_vector @@ q
  UNION ALL
  SELECT 'invoice'::text, i.id::text, i.invoice_number,
         i.status || ' · ' || coalesce(i.total::text, ''), ts_rank(i.search_vector, q)
  FROM public.invoices i
  WHERE i.workspace_id = p_workspace_id AND i.search_vector @@ q
  UNION ALL
  SELECT 'member'::text, p.id::text, coalesce(p.full_name, p.email), wm.role,
         ts_rank(to_tsvector('simple', coalesce(p.full_name,'') || ' ' || coalesce(p.email,'')), q)
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(p.full_name,'') || ' ' || coalesce(p.email,'')) @@ q
  UNION ALL
  SELECT 'notification'::text, n.id::text, n.title, coalesce(n.body, ''),
         ts_rank(to_tsvector('simple', coalesce(n.title,'') || ' ' || coalesce(n.body,'')), q)
  FROM public.notifications n
  WHERE n.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(n.title,'') || ' ' || coalesce(n.body,'')) @@ q
  UNION ALL
  SELECT 'activity'::text, a.id::text, a.action,
         a.entity_type || ' · ' || coalesce(a.entity_id, ''),
         ts_rank(to_tsvector('simple', coalesce(a.action,'') || ' ' || coalesce(a.entity_type,'')), q)
  FROM public.activity_logs a
  WHERE a.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(a.action,'') || ' ' || coalesce(a.entity_type,'')) @@ q
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 8. DEVELOPER API (keys + audit + rate-limit support)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,            -- e.g. 'bm_live_a1b2c3' shown in UI
  key_hash text NOT NULL UNIQUE,       -- sha256 of the full secret; raw key shown once
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  rate_limit_per_min int NOT NULL DEFAULT 60,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON public.api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE NOT revoked;

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method text,
  path text,
  status_code int,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_logs_workspace ON public.api_request_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON public.api_request_logs(api_key_id, created_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Only owners/admins manage API keys; the secret hash is never selectable to
-- members (the column is excluded by app queries; RLS guards row visibility).
DROP POLICY IF EXISTS "Admins manage api keys" ON public.api_keys;
CREATE POLICY "Admins manage api keys" ON public.api_keys
  FOR ALL USING (
    public.is_workspace_member(workspace_id, auth.uid())
    AND public.workspace_role(workspace_id) IN ('owner', 'admin')
  );

DROP POLICY IF EXISTS "Members view api logs" ON public.api_request_logs;
CREATE POLICY "Members view api logs" ON public.api_request_logs
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- ==============================================================================
-- 9. REALTIME PUBLICATION
-- ==============================================================================
-- Add new tables to the realtime publication so the client receives changes.
DO $$
BEGIN
  -- notifications (powers the notification bell)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  -- messages (client <-> workspace chat)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found; skipping realtime registration.';
END $$;

COMMIT;

-- Reload PostgREST schema cache so new tables/columns are exposed immediately.
NOTIFY pgrst, 'reload schema';
