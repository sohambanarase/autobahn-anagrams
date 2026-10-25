-- Run this in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run again on an existing project (it only adds what's missing).
-- Creates a tiny table + a ping() function. The daily keep-alive calls ping(),
-- which writes a timestamp, so Supabase sees real database activity and
-- never pauses the free project.

create table if not exists public.keepalive (
  id int primary key,
  note text default 'Autobahn Anagrams keep-alive'
);
alter table public.keepalive add column if not exists pinged_at timestamptz default now();
alter table public.keepalive add column if not exists pings bigint default 0;
insert into public.keepalive (id) values (1) on conflict (id) do nothing;

alter table public.keepalive enable row level security;
drop policy if exists "keepalive read" on public.keepalive;
create policy "keepalive read" on public.keepalive for select to anon using (true);
grant select on public.keepalive to anon;

-- ping(): the only way the public key can change anything, and all it does is bump a timestamp.
create or replace function public.ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive set pinged_at = now(), pings = coalesce(pings,0) + 1 where id = 1
  returning pinged_at;
$$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon;
