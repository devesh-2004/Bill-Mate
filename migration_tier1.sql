-- Tier 1 Features Migration

-- 1. Add Reminder tracking to invoices
alter table invoices 
add column if not exists reminder_sent_at timestamp with time zone;

-- 2. Add Multi-Currency & Tax support to invoices
alter table invoices 
add column if not exists currency text default 'USD',
add column if not exists tax_rate numeric default 0;

-- 3. Ensure AI Logs table exists (if not created earlier)
create table if not exists ai_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  invoice_id uuid references invoices(id) on delete set null,
  prompt text,
  response text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for AI Logs (if new)
alter table ai_logs enable row level security;
create policy "Users can view own logs" on ai_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on ai_logs for insert with check (auth.uid() = user_id);
