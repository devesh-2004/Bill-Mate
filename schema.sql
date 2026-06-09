-- ==============================================================================
-- BILLMATE MULTI-TENANT SAAS SCHEMA
-- This schema establishes a robust workspace-centric architecture.
-- ==============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. USERS & PROFILES
-- ==============================================================================

create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- ==============================================================================
-- 2. WORKSPACES (THE TENANT)
-- ==============================================================================

create table if not exists workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique, -- For URL routing (e.g. billmate.app/w/acme-corp)
  logo_url text,
  currency text default 'USD' not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table workspaces enable row level security;

-- Only members can view the workspace
create policy "Workspace members can view workspace" on workspaces for select using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = id and wm.user_id = auth.uid()
  )
);

-- Only owners can update the workspace
create policy "Workspace owners can update workspace" on workspaces for update using (auth.uid() = owner_id);
-- Any authenticated user can create a workspace
create policy "Users can create workspaces" on workspaces for insert with check (auth.uid() = owner_id);

-- ==============================================================================
-- 3. WORKSPACE MEMBERS (RBAC)
-- ==============================================================================
-- Roles: 'owner', 'admin', 'accountant', 'member'

create table if not exists workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'accountant', 'member')) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(workspace_id, user_id)
);

alter table workspace_members enable row level security;

-- Members can see who else is in the workspace
create policy "Members can view other members" on workspace_members for select using (
  exists (
    select 1 from workspace_members wm 
    where wm.workspace_id = workspace_members.workspace_id 
    and wm.user_id = auth.uid()
  )
);

-- Automatically add the owner as an 'owner' role when a workspace is created
create or replace function public.handle_new_workspace() 
returns trigger as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_workspace_created on workspaces;
create trigger on_workspace_created
  after insert on workspaces
  for each row execute function public.handle_new_workspace();

-- ==============================================================================
-- 4. CLIENTS
-- ==============================================================================

create table if not exists clients (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  address text,
  tax_id text, -- e.g., VAT number
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table clients enable row level security;
-- Policy: Only members of the workspace can access clients
create policy "Workspace members can access clients" on clients for all using (
  exists (select 1 from workspace_members where workspace_id = clients.workspace_id and user_id = auth.uid())
);

-- ==============================================================================
-- 5. INVOICES
-- ==============================================================================

create table if not exists invoices (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  invoice_number text not null,
  status text check (status in ('Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled')) default 'Draft',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  currency text default 'USD',
  notes text,
  terms text,
  issue_date date default CURRENT_DATE,
  due_date date,
  paid_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(workspace_id, invoice_number)
);

alter table invoices enable row level security;
create policy "Workspace members can access invoices" on invoices for all using (
  exists (select 1 from workspace_members where workspace_id = invoices.workspace_id and user_id = auth.uid())
);

-- ==============================================================================
-- 6. INVOICE ITEMS
-- ==============================================================================

create table if not exists invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric not null default 1,
  price numeric not null default 0,
  tax_rate numeric default 0
);

alter table invoice_items enable row level security;
create policy "Workspace members can access invoice items" on invoice_items for all using (
  exists (
    select 1 from invoices
    join workspace_members on invoices.workspace_id = workspace_members.workspace_id
    where invoices.id = invoice_items.invoice_id and workspace_members.user_id = auth.uid()
  )
);

-- ==============================================================================
-- 7. PAYMENTS
-- ==============================================================================

create table if not exists payments (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  invoice_id uuid references invoices(id) on delete cascade not null,
  amount numeric not null,
  payment_method text, -- 'Credit Card', 'Bank Transfer', 'Cash'
  payment_date timestamp with time zone default timezone('utc'::text, now()),
  reference_number text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table payments enable row level security;
create policy "Workspace members can access payments" on payments for all using (
  exists (select 1 from workspace_members where workspace_id = payments.workspace_id and user_id = auth.uid())
);

-- ==============================================================================
-- 8. INVOICE TEMPLATES
-- ==============================================================================

create table if not exists invoice_templates (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null default 'Default Template',
  logo_url text,
  primary_color text default '#000000',
  secondary_color text default '#ffffff',
  font_family text default 'Inter',
  footer_text text,
  created_at timestamptz default now()
);

alter table invoice_templates enable row level security;
create policy "Workspace members can access templates" on invoice_templates for all using (
  exists (select 1 from workspace_members where workspace_id = invoice_templates.workspace_id and user_id = auth.uid())
);

-- ==============================================================================
-- 9. AI REPORTS
-- ==============================================================================

create table if not exists ai_reports (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  report_type text not null, -- 'monthly_summary', 'client_analysis', 'invoice_insight'
  content jsonb not null,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table ai_reports enable row level security;
create policy "Workspace members can view AI reports" on ai_reports for select using (
  exists (select 1 from workspace_members where workspace_id = ai_reports.workspace_id and user_id = auth.uid())
);

-- ==============================================================================
-- 10. ACTIVITY LOGS (AUDIT)
-- ==============================================================================

create table if not exists activity_logs (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null, -- 'invoice', 'client', 'workspace', 'payment'
  entity_id text not null,
  action text not null, -- 'created', 'updated', 'deleted', 'sent'
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table activity_logs enable row level security;
create policy "Workspace members can view logs" on activity_logs for select using (
  exists (select 1 from workspace_members where workspace_id = activity_logs.workspace_id and user_id = auth.uid())
);
-- Logs should generally only be inserted via triggers or trusted server actions, but for client access:
create policy "Workspace members can insert logs" on activity_logs for insert with check (
  exists (select 1 from workspace_members where workspace_id = activity_logs.workspace_id and user_id = auth.uid())
);
