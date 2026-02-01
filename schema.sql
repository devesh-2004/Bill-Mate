-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- 2. CLIENTS
create table clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table clients enable row level security;
create policy "Users can crud own clients" on clients for all using (auth.uid() = user_id);

-- 3. INVOICES
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  client_id uuid references clients(id) on delete cascade not null,
  invoice_number text not null,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  status text check (status in ('Paid', 'Pending', 'Overdue')) default 'Pending',
  due_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, invoice_number)
);
alter table invoices enable row level security;
create policy "Users can crud own invoices" on invoices for all using (auth.uid() = user_id);

-- 4. INVOICE ITEMS
create table invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  description text not null,
  quantity integer not null default 1,
  price numeric not null default 0
);
alter table invoice_items enable row level security;
-- Items are accessible if the user owns the parent invoice.
-- A simple way is to join, but for simplicity/performance in RLS we can check via invoice_id.
-- However, standard practice often duplicates user_id or does aexists check.
-- Let's use EXISTS for correctness.
create policy "Users can crud own invoice items" on invoice_items for all using (
  exists (
    select 1 from invoices
    where invoices.id = invoice_items.invoice_id
    and invoices.user_id = auth.uid()
  )
);

-- 5. AI LOGS
create table ai_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  invoice_id uuid references invoices(id) on delete set null,
  prompt text,
  response text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table ai_logs enable row level security;
create policy "Users can view own logs" on ai_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on ai_logs for insert with check (auth.uid() = user_id);

-- STORAGE (If creating a bucket)
-- insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false);
-- create policy "Users can upload invoice pdfs" on storage.objects for insert with check (bucket_id = 'invoices' and auth.uid() = owner);
-- create policy "Users can view own invoice pdfs" on storage.objects for select using (bucket_id = 'invoices' and auth.uid() = owner);
