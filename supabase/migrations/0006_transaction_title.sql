-- Migration 0006: Add title to transactions table for custom transaction title
alter table public.transactions add column if not exists title text;

-- Notify PostgREST to reload its schema cache
notify pgrst, 'reload schema';
