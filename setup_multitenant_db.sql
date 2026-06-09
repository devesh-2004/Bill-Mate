-- ==============================================================================
-- BILLMATE COMPLETE MULTI-TENANT SETUP & MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor to fully update your database schema.
-- ==============================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add email column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
  END IF;
END $$;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  currency text DEFAULT 'USD' NOT NULL,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 3. Create workspace_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'accountant', 'member')) NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS on workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Trigger to automatically add the owner as an 'owner' role when a workspace is created
CREATE OR REPLACE FUNCTION public.handle_new_workspace() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- 4. Create clients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  tax_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add workspace_id to clients if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 5. Create invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  status text CHECK (status IN ('Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled')) DEFAULT 'Draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  notes text,
  terms text,
  issue_date date DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add workspace_id, discount, notes, terms, issue_date, tax_rate, reminder_sent_at to invoices if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'workspace_id') THEN
    ALTER TABLE public.invoices ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'discount') THEN
    ALTER TABLE public.invoices ADD COLUMN discount numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
    ALTER TABLE public.invoices ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'terms') THEN
    ALTER TABLE public.invoices ADD COLUMN terms text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'issue_date') THEN
    ALTER TABLE public.invoices ADD COLUMN issue_date date DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tax_rate') THEN
    ALTER TABLE public.invoices ADD COLUMN tax_rate numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'reminder_sent_at') THEN
    ALTER TABLE public.invoices ADD COLUMN reminder_sent_at timestamptz;
  END IF;
END $$;

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 6. Migrate Data: Link existing clients/invoices to a default workspace for each user
DO $$
DECLARE
    user_record record;
    new_workspace_id uuid;
    db_has_user_id_clients boolean;
    db_has_user_id_invoices boolean;
BEGIN
    -- Check if single-tenant 'user_id' column exists to migrate existing user-scoped data
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'user_id') INTO db_has_user_id_clients;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'user_id') INTO db_has_user_id_invoices;

    IF db_has_user_id_clients OR db_has_user_id_invoices THEN
        -- Loop over users who have clients/invoices
        FOR user_record IN 
            SELECT DISTINCT user_id FROM (
                SELECT user_id FROM public.clients WHERE user_id IS NOT NULL AND db_has_user_id_clients
                UNION
                SELECT user_id FROM public.invoices WHERE user_id IS NOT NULL AND db_has_user_id_invoices
            ) AS user_list
        LOOP
            -- Check if user already owns a workspace
            SELECT id INTO new_workspace_id FROM public.workspaces WHERE owner_id = user_record.user_id LIMIT 1;
            
            IF new_workspace_id IS NULL THEN
                -- Create a default workspace for the user
                INSERT INTO public.workspaces (name, owner_id) 
                VALUES ('My Workspace', user_record.user_id) 
                RETURNING id INTO new_workspace_id;
                
                -- Add user as owner in members
                INSERT INTO public.workspace_members (workspace_id, user_id, role)
                VALUES (new_workspace_id, user_record.user_id, 'owner')
                ON CONFLICT DO NOTHING;
            END IF;

            -- Migrate clients
            IF db_has_user_id_clients THEN
                EXECUTE 'UPDATE public.clients SET workspace_id = $1 WHERE user_id = $2 AND workspace_id IS NULL'
                USING new_workspace_id, user_record.user_id;
            END IF;

            -- Migrate invoices
            IF db_has_user_id_invoices THEN
                EXECUTE 'UPDATE public.invoices SET workspace_id = $1 WHERE user_id = $2 AND workspace_id IS NULL'
                USING new_workspace_id, user_record.user_id;
            END IF;
        END LOOP;
    END IF;
END $$;

-- If workspaces is completely empty, make sure to handle any orphaned inserts
DO $$
DECLARE
    first_user_id uuid;
    fallback_workspace_id uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM public.clients WHERE workspace_id IS NULL) OR EXISTS (SELECT 1 FROM public.invoices WHERE workspace_id IS NULL) THEN
        -- Get any user ID from auth.users
        SELECT id INTO first_user_id FROM auth.users LIMIT 1;
        
        IF first_user_id IS NOT NULL THEN
            SELECT id INTO fallback_workspace_id FROM public.workspaces WHERE owner_id = first_user_id LIMIT 1;
            IF fallback_workspace_id IS NULL THEN
                INSERT INTO public.workspaces (name, owner_id) 
                VALUES ('System Workspace', first_user_id) 
                RETURNING id INTO fallback_workspace_id;
            END IF;
            
            UPDATE public.clients SET workspace_id = fallback_workspace_id WHERE workspace_id IS NULL;
            UPDATE public.invoices SET workspace_id = fallback_workspace_id WHERE workspace_id IS NULL;
        END IF;
    END IF;
END $$;

-- Now set workspace_id to NOT NULL
ALTER TABLE public.clients ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN workspace_id SET NOT NULL;

-- Remove old single-tenant unique constraint and columns if they exist
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_user_id_invoice_number_key;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_workspace_id_invoice_number_key;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_workspace_id_invoice_number_key UNIQUE(workspace_id, invoice_number);

-- 7. Create invoice_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0
);

-- Enable RLS on invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 8. Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_method text,
  payment_date timestamp with time zone DEFAULT timezone('utc'::text, now()),
  reference_number text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 9. Create invoice_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invoice_templates (
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

-- Enable RLS on invoice_templates
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- 10. Update profiles trigger to capture email from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = excluded.email,
    full_name = COALESCE(excluded.full_name, profiles.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill email for existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- 11. RE-CREATE RLS POLICIES FOR WORKSPACE SECURITY
-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT 
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Workspaces
DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces;
CREATE POLICY "Workspace members can view workspace" ON public.workspaces FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Workspace owners can update workspace" ON public.workspaces;
CREATE POLICY "Workspace owners can update workspace" ON public.workspaces FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Workspace Members
DROP POLICY IF EXISTS "Members can view other members" ON public.workspace_members;
CREATE POLICY "Members can view other members" ON public.workspace_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.workspace_id = workspace_members.workspace_id 
    AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Workspace owners and admins can insert members" ON public.workspace_members;
CREATE POLICY "Workspace owners and admins can insert members" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Workspace owners and admins can update members" ON public.workspace_members;
CREATE POLICY "Workspace owners and admins can update members" ON public.workspace_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Workspace owners and admins can delete members" ON public.workspace_members;
CREATE POLICY "Workspace owners and admins can delete members" ON public.workspace_members
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

-- Clients
DROP POLICY IF EXISTS "Workspace members can access clients" ON public.clients;
CREATE POLICY "Workspace members can access clients" ON public.clients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = clients.workspace_id AND user_id = auth.uid())
);

-- Invoices
DROP POLICY IF EXISTS "Workspace members can access invoices" ON public.invoices;
CREATE POLICY "Workspace members can access invoices" ON public.invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = invoices.workspace_id AND user_id = auth.uid())
);

-- Invoice Items
DROP POLICY IF EXISTS "Workspace members can access invoice items" ON public.invoice_items;
CREATE POLICY "Workspace members can access invoice items" ON public.invoice_items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.invoices
    JOIN public.workspace_members ON invoices.workspace_id = workspace_members.workspace_id
    WHERE invoices.id = invoice_items.invoice_id AND workspace_members.user_id = auth.uid()
  )
);

-- Payments
DROP POLICY IF EXISTS "Workspace members can access payments" ON public.payments;
CREATE POLICY "Workspace members can access payments" ON public.payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = payments.workspace_id AND user_id = auth.uid())
);

-- Invoice Templates
DROP POLICY IF EXISTS "Workspace members can access templates" ON public.invoice_templates;
CREATE POLICY "Workspace members can access templates" ON public.invoice_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = invoice_templates.workspace_id AND user_id = auth.uid())
);

COMMIT;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
