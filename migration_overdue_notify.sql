-- ==============================================================================
-- Adds the column the worker uses to avoid re-sending overdue SMS/email.
-- Run once in the Supabase SQL Editor (already included in setup_fresh.sql).
-- ==============================================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;
NOTIFY pgrst, 'reload schema';
