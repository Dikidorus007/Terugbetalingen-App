-- PayNote: rekeningnummers voor personen en kostenrekeningen, plus persoonlijke contacten.

create sequence if not exists public.paynote_account_number_seq start with 100001;

create or replace function public.next_paynote_account_number()
returns text
language plpgsql
volatile
as 'begin return ''PN-'' || lpad(nextval(''public.paynote_account_number_seq'')::text, 6, ''0''); end;';

alter table public.people add column if not exists account_number text;
alter table public.accounts add column if not exists account_number text;

update public.people
set account_number = public.next_paynote_account_number()
where account_number is null or btrim(account_number) = '';

update public.accounts
set account_number = public.next_paynote_account_number()
where account_number is null or btrim(account_number) = '';

alter table public.people alter column account_number set default public.next_paynote_account_number();
alter table public.accounts alter column account_number set default public.next_paynote_account_number();
alter table public.people alter column account_number set not null;
alter table public.accounts alter column account_number set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_account_number_key') then
    alter table public.people add constraint people_account_number_key unique (account_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_account_number_key') then
    alter table public.accounts add constraint accounts_account_number_key unique (account_number);
  end if;
end $$;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  account_number text not null check (char_length(btrim(account_number)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, account_number)
);

alter table public.contacts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts' and policyname = 'Users manage their own contacts') then
    create policy "Users manage their own contacts" on public.contacts
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contacts'
  ) then
    alter publication supabase_realtime add table public.contacts;
  end if;
end $$;
