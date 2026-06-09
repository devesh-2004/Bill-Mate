-- ==============================================================================
-- BILLMATE — FRESH CONSOLIDATED SETUP  (multi-tenant base + Tier 5 Financial Ops)
-- ------------------------------------------------------------------------------
-- ⚠️  DESTRUCTIVE: drops and recreates all BillMate tables. Run once on a dev
--     database to get a clean, correct schema. auth.users is NOT touched.
--
-- RLS design (no recursion): workspace_members policies are PURE self-checks
-- (user_id = auth.uid()) — no subqueries, so the "infinite recursion" error is
-- impossible. All other tables are workspace-scoped. Listing/managing OTHER
-- members is done server-side with the service role (see team-actions.ts).
--
-- Run in the Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- Helper functions (section 1) reference tables created later (sections 2-4).
-- LANGUAGE sql validates function bodies at CREATE time, so defer that check
-- for this transaction; the functions resolve fine at run time once tables exist.
SET LOCAL check_function_bodies = off;

-- ------------------------------------------------------------------------------
-- 0. DROP EXISTING OBJECTS (clean slate)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace members manage receipts" ON storage.objects;

DROP TABLE IF EXISTS public.api_request_logs CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.razorpay_events CASCADE;
DROP TABLE IF EXISTS public.stripe_events CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;
DROP TABLE IF EXISTS public.client_portal_access CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP TABLE IF EXISTS public.recurring_invoices CASCADE;
DROP TABLE IF EXISTS public.ai_reports CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.invoice_templates CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS (SECURITY DEFINER — used only by NON-workspace_members
--    policies, so there is never a self-referential policy)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role IN ('owner','admin')
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() LIMIT 1;
$$;

-- True if the caller shares any workspace with p_other (for profile visibility).
CREATE OR REPLACE FUNCTION public.shares_workspace(p_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members a
    JOIN public.workspace_members b ON a.workspace_id = b.workspace_id
    WHERE a.user_id = auth.uid() AND b.user_id = p_other
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid,uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid,uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.shares_workspace(uuid) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 2. PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING ( auth.uid() = id OR public.shares_workspace(id) );
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING ( auth.uid() = id );

-- Sync auth.users -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email)
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        full_name = COALESCE(excluded.full_name, profiles.full_name);
  RETURN new;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth users
INSERT INTO public.profiles (id, full_name, avatar_url, email)
SELECT id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url', email
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. WORKSPACES
-- ------------------------------------------------------------------------------
CREATE TABLE public.workspaces (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  currency text DEFAULT 'USD' NOT NULL,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.workspaces FOR SELECT
  USING ( public.is_workspace_member(id, auth.uid()) );
CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT WITH CHECK ( auth.uid() = owner_id );
CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE USING ( auth.uid() = owner_id );
CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE USING ( auth.uid() = owner_id );

-- ------------------------------------------------------------------------------
-- 4. WORKSPACE MEMBERS  — PURE SELF-CHECK POLICIES (cannot recurse)
-- ------------------------------------------------------------------------------
CREATE TABLE public.workspace_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner','admin','accountant','member')) NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
-- A user can only see/insert/update/delete their OWN membership rows directly.
-- Admin operations on other members go through the service role (team-actions.ts).
CREATE POLICY "wm_select_self" ON public.workspace_members FOR SELECT USING ( user_id = auth.uid() );
CREATE POLICY "wm_insert_self" ON public.workspace_members FOR INSERT WITH CHECK ( user_id = auth.uid() );
CREATE POLICY "wm_update_self" ON public.workspace_members FOR UPDATE USING ( user_id = auth.uid() );
CREATE POLICY "wm_delete_self" ON public.workspace_members FOR DELETE USING ( user_id = auth.uid() );

-- Auto-add the creator as owner.
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN new;
END; $$;
DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 5. CLIENTS  (+ billing profile + search vector)
-- ------------------------------------------------------------------------------
CREATE TABLE public.clients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  tax_id text,
  billing_email text,
  billing_name text,
  billing_address text,
  razorpay_customer_id text,
  portal_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name,'')||' '||coalesce(email,'')||' '||coalesce(phone,'')||' '||coalesce(billing_name,''))
  ) STORED
);
CREATE INDEX idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX idx_clients_search ON public.clients USING gin(search_vector);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_all" ON public.clients FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 6. INVOICES (+ recurring link, razorpay, search vector)
-- ------------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  status text CHECK (status IN ('Draft','Pending','Paid','Overdue','Cancelled')) DEFAULT 'Draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  notes text,
  terms text,
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  overdue_notified_at timestamptz,  -- set when the due-date SMS/email goes out
  recurring_invoice_id uuid,  -- FK added after recurring_invoices exists
  razorpay_order_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, invoice_number),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(invoice_number,'')||' '||coalesce(notes,'')||' '||coalesce(status,''))
  ) STORED
);
CREATE INDEX idx_invoices_workspace ON public.invoices(workspace_id);
CREATE INDEX idx_invoices_search ON public.invoices USING gin(search_vector);
CREATE INDEX idx_invoices_razorpay_order ON public.invoices(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_all" ON public.invoices FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

CREATE TABLE public.invoice_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items_all" ON public.invoice_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_items.invoice_id
          AND public.is_workspace_member(i.workspace_id, auth.uid()))
);

-- ------------------------------------------------------------------------------
-- 7. PAYMENTS (+ razorpay)
-- ------------------------------------------------------------------------------
CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_method text,
  status text DEFAULT 'succeeded' CHECK (status IN ('pending','succeeded','failed','refunded')),
  razorpay_payment_id text,
  razorpay_order_id text,
  payment_date timestamptz DEFAULT now(),
  reference_number text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX uq_payments_razorpay_payment ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_all" ON public.payments FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 8. INVOICE TEMPLATES
-- ------------------------------------------------------------------------------
CREATE TABLE public.invoice_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT 'Default Template',
  logo_url text,
  primary_color text DEFAULT '#000000',
  secondary_color text DEFAULT '#ffffff',
  font_family text DEFAULT 'Inter',
  footer_text text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_all" ON public.invoice_templates FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 9. AI REPORTS (forecasts reuse this; report_type='forecast')
-- ------------------------------------------------------------------------------
CREATE TABLE public.ai_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  report_type text NOT NULL,
  content jsonb NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );
CREATE POLICY "ai_reports_insert" ON public.ai_reports FOR INSERT
  WITH CHECK ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 10. ACTIVITY LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_activity_logs_workspace ON public.activity_logs(workspace_id, created_at DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON public.activity_logs FOR SELECT
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );
CREATE POLICY "activity_insert" ON public.activity_logs FOR INSERT
  WITH CHECK ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 11. RECURRING INVOICES
-- ------------------------------------------------------------------------------
CREATE TABLE public.recurring_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  title text,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
  interval_count int NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text DEFAULT 'USD',
  tax_rate numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  notes text,
  terms text,
  due_days int NOT NULL DEFAULT 14,
  auto_send boolean NOT NULL DEFAULT false,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  occurrences_generated int NOT NULL DEFAULT 0,
  max_occurrences int,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_recurring_workspace ON public.recurring_invoices(workspace_id);
CREATE INDEX idx_recurring_due ON public.recurring_invoices(next_run_at) WHERE status = 'active';
CREATE TRIGGER trg_recurring_updated BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_all" ON public.recurring_invoices FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- Now wire the invoices -> recurring_invoices FK.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_recurring_fk
  FOREIGN KEY (recurring_invoice_id) REFERENCES public.recurring_invoices(id) ON DELETE SET NULL;
CREATE INDEX idx_invoices_recurring ON public.invoices(recurring_invoice_id);

-- ------------------------------------------------------------------------------
-- 12. EXPENSES
-- ------------------------------------------------------------------------------
CREATE TABLE public.expense_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, name)
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_cat_all" ON public.expense_categories FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

CREATE TABLE public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor text,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  status text DEFAULT 'recorded' CHECK (status IN ('recorded','reimbursed','pending')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_expenses_workspace ON public.expenses(workspace_id, expense_date DESC);
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- Receipts storage bucket (private) — path: receipts/<workspace_id>/<expense_id>/...
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts','receipts',false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Workspace members manage receipts" ON storage.objects FOR ALL
  USING ( bucket_id = 'receipts' AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid()) )
  WITH CHECK ( bucket_id = 'receipts' AND public.is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  entity_type text,
  entity_id text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_notifications_inbox ON public.notifications(workspace_id, user_id, read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT
  USING ( public.is_workspace_member(workspace_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()) );
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE
  USING ( public.is_workspace_member(workspace_id, auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()) );
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT
  WITH CHECK ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 14. CLIENT SELF-SERVICE PORTAL (disputes, messages, token access)
-- ------------------------------------------------------------------------------
CREATE TABLE public.client_portal_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  token_hash text NOT NULL UNIQUE,
  email text,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_access_all" ON public.client_portal_access FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

CREATE TABLE public.disputes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','rejected')),
  resolution_note text,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_disputes_workspace ON public.disputes(workspace_id, status);
CREATE TRIGGER trg_disputes_updated BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes_all" ON public.disputes FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  dispute_id uuid REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client','workspace')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_messages_thread ON public.messages(workspace_id, client_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all" ON public.messages FOR ALL
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 15. RAZORPAY WEBHOOK IDEMPOTENCY (service-role only)
-- ------------------------------------------------------------------------------
CREATE TABLE public.razorpay_events (
  id text PRIMARY KEY,
  type text,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  payload jsonb,
  processed_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.razorpay_events ENABLE ROW LEVEL SECURITY;  -- no policy: service role only

-- ------------------------------------------------------------------------------
-- 16. DEVELOPER API (keys + audit)
-- ------------------------------------------------------------------------------
CREATE TABLE public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  rate_limit_per_min int NOT NULL DEFAULT 60,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_api_keys_workspace ON public.api_keys(workspace_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE NOT revoked;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_admin" ON public.api_keys FOR ALL USING (
  public.is_workspace_member(workspace_id, auth.uid())
  AND public.workspace_role(workspace_id) IN ('owner','admin')
);

CREATE TABLE public.api_request_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method text, path text, status_code int, ip text, user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_api_logs_workspace ON public.api_request_logs(workspace_id, created_at DESC);
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_logs_select" ON public.api_request_logs FOR SELECT
  USING ( public.is_workspace_member(workspace_id, auth.uid()) );

-- ------------------------------------------------------------------------------
-- 17. GLOBAL FULL-TEXT SEARCH RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_workspace(p_workspace_id uuid, p_query text)
RETURNS TABLE (entity_type text, entity_id text, title text, subtitle text, rank real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q tsquery;
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a workspace member';
  END IF;
  q := websearch_to_tsquery('simple', coalesce(p_query,''));
  IF q IS NULL OR length(trim(coalesce(p_query,''))) = 0 THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'client'::text, c.id::text, c.name, coalesce(c.email,c.phone,''), ts_rank(c.search_vector, q)
  FROM public.clients c WHERE c.workspace_id = p_workspace_id AND c.search_vector @@ q
  UNION ALL
  SELECT 'invoice'::text, i.id::text, i.invoice_number, i.status||' · '||coalesce(i.total::text,''), ts_rank(i.search_vector, q)
  FROM public.invoices i WHERE i.workspace_id = p_workspace_id AND i.search_vector @@ q
  UNION ALL
  SELECT 'member'::text, p.id::text, coalesce(p.full_name,p.email), wm.role,
         ts_rank(to_tsvector('simple', coalesce(p.full_name,'')||' '||coalesce(p.email,'')), q)
  FROM public.workspace_members wm JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(p.full_name,'')||' '||coalesce(p.email,'')) @@ q
  UNION ALL
  SELECT 'notification'::text, n.id::text, n.title, coalesce(n.body,''),
         ts_rank(to_tsvector('simple', coalesce(n.title,'')||' '||coalesce(n.body,'')), q)
  FROM public.notifications n WHERE n.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(n.title,'')||' '||coalesce(n.body,'')) @@ q
  UNION ALL
  SELECT 'activity'::text, a.id::text, a.action, a.entity_type||' · '||coalesce(a.entity_id,''),
         ts_rank(to_tsvector('simple', coalesce(a.action,'')||' '||coalesce(a.entity_type,'')), q)
  FROM public.activity_logs a WHERE a.workspace_id = p_workspace_id
    AND to_tsvector('simple', coalesce(a.action,'')||' '||coalesce(a.entity_type,'')) @@ q
  ORDER BY 5 DESC LIMIT 50;  -- 5th column (rank); positional avoids name ambiguity
END; $$;
GRANT EXECUTE ON FUNCTION public.search_workspace(uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 18. REALTIME PUBLICATION (notification bell, live invoice/message updates)
-- ------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notifications','messages','invoices']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found; skipping.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
