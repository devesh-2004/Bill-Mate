-- Run this in your Supabase SQL Editor to add email to profiles
-- and enable cross-member visibility for team invites

-- Add email column to profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'profiles' and column_name = 'email'
  ) then
    alter table profiles add column email text;
  end if;
end $$;

-- Add reminder_sent_at to invoices if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'invoices' and column_name = 'reminder_sent_at'
  ) then
    alter table invoices add column reminder_sent_at timestamptz;
  end if;
end $$;

-- Add tax_rate to invoices if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'invoices' and column_name = 'tax_rate'
  ) then
    alter table invoices add column tax_rate numeric default 0;
  end if;
end $$;

-- Add notes column to invoices if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'invoices' and column_name = 'notes'
  ) then
    alter table invoices add column notes text;
  end if;
end $$;

-- Add terms column to invoices if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'invoices' and column_name = 'terms'
  ) then
    alter table invoices add column terms text;
  end if;
end $$;

-- Add issue_date column to invoices if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'invoices' and column_name = 'issue_date'
  ) then
    alter table invoices add column issue_date date default CURRENT_DATE;
  end if;
end $$;

-- Update profiles trigger to capture email from auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do update
  set 
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill email for existing profiles from auth.users
-- (Run this once to populate existing users' emails)
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
and p.email is null;

-- Allow workspace members to see other members' profiles (for team display)
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles 
  for select 
  using (
    auth.uid() = id 
    OR 
    exists (
      select 1 from workspace_members wm1
      join workspace_members wm2 on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = auth.uid() and wm2.user_id = profiles.id
    )
  );

-- Policies for workspace_members table to allow owners/admins to manage memberships
drop policy if exists "Workspace owners and admins can insert members" on workspace_members;
create policy "Workspace owners and admins can insert members" on workspace_members
  for insert
  with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_members.workspace_id
      and w.owner_id = auth.uid()
    )
    OR
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Workspace owners and admins can update members" on workspace_members;
create policy "Workspace owners and admins can update members" on workspace_members
  for update
  using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_members.workspace_id
      and w.owner_id = auth.uid()
    )
    OR
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
    )
  );

drop policy if exists "Workspace owners and admins can delete members" on workspace_members;
create policy "Workspace owners and admins can delete members" on workspace_members
  for delete
  using (
    auth.uid() = user_id
    OR
    exists (
      select 1 from workspaces w
      where w.id = workspace_members.workspace_id
      and w.owner_id = auth.uid()
    )
    OR
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
    )
  );

