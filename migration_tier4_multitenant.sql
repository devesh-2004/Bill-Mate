-- ==============================================================================
-- BILLMATE MULTI-TENANT MIGRATION (PHASE 1)
-- Run this script in the Supabase SQL Editor.
-- This script safely migrates existing user-centric data to workspace-centric.
-- ==============================================================================

begin;

-- 1. Ensure workspaces and workspace_members exist (from previous schema_update.sql)
-- We will create a default workspace for every user who doesn't have one, 
-- or who has clients/invoices but no workspace.

do $$
declare
    user_record record;
    new_workspace_id uuid;
begin
    for user_record in select distinct user_id from clients union select distinct user_id from invoices loop
        -- Check if user already owns a workspace
        select id into new_workspace_id from workspaces where owner_id = user_record.user_id limit 1;
        
        if new_workspace_id is null then
            -- Create a default workspace for the user
            insert into workspaces (name, owner_id) 
            values ('My Workspace', user_record.user_id) 
            returning id into new_workspace_id;
            
            -- Trigger handles adding the owner to workspace_members, but just in case:
            insert into workspace_members (workspace_id, user_id, role)
            values (new_workspace_id, user_record.user_id, 'owner')
            on conflict do nothing;
        end if;
    end loop;
end $$;

-- 2. Add workspace_id to clients and invoices
alter table clients add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table invoices add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table invoices add column if not exists discount numeric not null default 0;
alter table invoices add column if not exists notes text;
alter table invoices add column if not exists terms text;
alter table invoices add column if not exists issue_date date default CURRENT_DATE;

-- 3. Migrate Data: Link existing clients/invoices to the user's first workspace
update clients c
set workspace_id = (select id from workspaces w where w.owner_id = c.user_id limit 1)
where workspace_id is null;

update invoices i
set workspace_id = (select id from workspaces w where w.owner_id = i.user_id limit 1)
where workspace_id is null;

-- 4. Make workspace_id NOT NULL now that data is migrated
-- (If there are orphaned records, they might fail here. We assume all had users.)
alter table clients alter column workspace_id set not null;
alter table invoices alter column workspace_id set not null;

-- 5. Drop old unique constraint on invoices and add new one based on workspace
alter table invoices drop constraint if exists invoices_user_id_invoice_number_key;
alter table invoices add constraint invoices_workspace_id_invoice_number_key unique(workspace_id, invoice_number);

-- 6. Update RLS Policies for multi-tenancy

-- Drop old policies
drop policy if exists "Users can crud own clients" on clients;
drop policy if exists "Users can crud own invoices" on invoices;
drop policy if exists "Users can crud own invoice items" on invoice_items;

-- Create new Workspace-based policies
create policy "Workspace members can access clients" on clients for all using (
  exists (select 1 from workspace_members where workspace_id = clients.workspace_id and user_id = auth.uid())
);

create policy "Workspace members can access invoices" on invoices for all using (
  exists (select 1 from workspace_members where workspace_id = invoices.workspace_id and user_id = auth.uid())
);

create policy "Workspace members can access invoice items" on invoice_items for all using (
  exists (
    select 1 from invoices
    join workspace_members on invoices.workspace_id = workspace_members.workspace_id
    where invoices.id = invoice_items.invoice_id and workspace_members.user_id = auth.uid()
  )
);

-- 7. Add Payments Table
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references workspaces(id) on delete cascade not null,
  invoice_id uuid references invoices(id) on delete cascade not null,
  amount numeric not null,
  payment_method text,
  payment_date timestamp with time zone default timezone('utc'::text, now()),
  reference_number text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table payments enable row level security;
create policy "Workspace members can access payments" on payments for all using (
  exists (select 1 from workspace_members where workspace_id = payments.workspace_id and user_id = auth.uid())
);

commit;
