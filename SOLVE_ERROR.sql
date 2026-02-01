-- Run this in Supabase SQL Editor to fix the "table not found" error

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

-- Force schema cache reload (sometimes works if run as admin)
NOTIFY pgrst, 'reload schema';
