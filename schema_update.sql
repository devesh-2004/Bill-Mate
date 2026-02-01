-- ====================================================
-- BILLMATE SCHEMA UPDATE (TIER 2 & 3 FEATURES)
-- Run this script in your Supabase SQL Editor
-- ====================================================

-- 1. Add paid_at to invoices if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'invoices' and column_name = 'paid_at') then
    alter table invoices add column paid_at timestamptz;
  end if;
end $$;

-- 2. Create invoice_templates table
create table if not exists invoice_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  logo_url text,
  primary_color text default '#000000',
  secondary_color text default '#ffffff',
  font_family text default 'Inter',
  created_at timestamptz default now()
);

alter table invoice_templates enable row level security;

create policy "Users can manage their own templates"
  on invoice_templates for all
  using (auth.uid() = user_id);

-- 3. Create activity_logs table
create table if not exists activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_type text not null, -- 'invoice' | 'client'
  entity_id text not null,
  action text not null, -- 'created' | 'updated' | 'sent' | 'downloaded'
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table activity_logs enable row level security;

create policy "Users can view their own logs"
  on activity_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on activity_logs for insert
  with check (auth.uid() = user_id);

-- 4. Create reports/analytics helper (Optional view)
create or replace view client_risk_stats as
select 
  client_id,
  count(*) as total_invoices,
  avg(extract(day from (paid_at - due_date))) as avg_delay_days,
  count(*) filter (where paid_at > due_date) as late_count
from invoices
where status = 'Paid' and paid_at is not null
group by client_id;

-- 5. Tier 3: Workspaces (Mini Teams)
create table if not exists workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

alter table workspaces enable row level security;

create policy "Owners can manage workspaces"
  on workspaces for all
  using (auth.uid() = owner_id);

create table if not exists workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (workspace_id, user_id)
);

alter table workspace_members enable row level security;

create policy "Members can view workspace members"
  on workspace_members for select
  using (
    exists (
      select 1 from workspace_members wm 
      where wm.workspace_id = workspace_members.workspace_id 
      and wm.user_id = auth.uid()
    )
    or
    exists (
        select 1 from workspaces w
        where w.id = workspace_members.workspace_id
        and w.owner_id = auth.uid()
    )
  );

-- Function to automatically add owner as member
create or replace function add_owner_as_member()
returns trigger as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'admin');
  return new;
end;
$$ language plpgsql;

create trigger on_workspace_created
  after insert on workspaces
  for each row execute function add_owner_as_member();

