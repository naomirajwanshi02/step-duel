-- Step Duel database setup.
-- 1. Change CHANGE-ME below to a passcode only Bipu and Noma know.
-- 2. In Supabase open SQL Editor -> New query, paste this whole file, press Run.
-- To change the passcode later, edit it below and run only the "create or replace function" part again.

create or replace function public.passcode_ok()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('request.headers', true)::json ->> 'x-passcode', '') = 'CHANGE-ME'
$$;

create table if not exists public.entries (
  player     text        not null check (player in ('bipu', 'noma')),
  day        date        not null,
  steps      integer     check (steps between 0 and 150000),
  weight     numeric(5,1) check (weight between 20 and 400),
  updated_at timestamptz not null default now(),
  primary key (player, day)
);

alter table public.entries enable row level security;

drop policy if exists "read with passcode"   on public.entries;
drop policy if exists "insert with passcode" on public.entries;
drop policy if exists "update with passcode" on public.entries;

create policy "read with passcode"   on public.entries for select to anon using (public.passcode_ok());
create policy "insert with passcode" on public.entries for insert to anon with check (public.passcode_ok());
create policy "update with passcode" on public.entries for update to anon using (public.passcode_ok()) with check (public.passcode_ok());

grant select, insert, update on public.entries to anon;
grant execute on function public.passcode_ok() to anon;
