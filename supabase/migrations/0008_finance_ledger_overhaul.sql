-- Migration 0008: Finance and Ledger overhaul
-- Expand transaction types to include 'transfer'
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in ('income', 'expense', 'transfer'));

-- Add account, transfer_account, and tags to transactions
alter table public.transactions add column if not exists account text default 'Bank account';
alter table public.transactions add column if not exists transfer_account text;
alter table public.transactions add column if not exists tags text[] default '{}';

-- Subscriptions upgrades
alter table public.subscriptions add column if not exists description text default '';
alter table public.subscriptions add column if not exists category text default 'Utilities';
alter table public.subscriptions add column if not exists account text default 'Bank account';
alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
alter table public.subscriptions add constraint subscriptions_billing_cycle_check check (billing_cycle in ('monthly', 'yearly', 'weekly', 'quarterly'));
alter table public.subscriptions add column if not exists status text default 'active' check (status in ('active', 'paused', 'cancelled'));
alter table public.subscriptions add column if not exists last_paid_date date;

-- Reload schema cache
notify pgrst, 'reload schema';
