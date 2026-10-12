-- Run this migration in the Supabase SQL editor.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  person_name text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_person_name_idx
  on public.push_subscriptions (person_name);

-- After deploying the Edge Function, create a Database Webhook in Supabase:
-- Table: public.expenses, event: INSERT, method: POST
-- URL: https://<project-ref>.supabase.co/functions/v1/notify-new-expense
-- Header: x-webhook-secret: <same value as WEBHOOK_SECRET Edge Function secret>
-- Body: standard Supabase Database Webhook payload.
