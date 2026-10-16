-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Creates a tiny table the daily keep-alive reads, so the free project never pauses.
create table if not exists public.keepalive (
  id int primary key,
  note text default 'Autobahn Anagrams keep-alive'
);
insert into public.keepalive (id) values (1) on conflict (id) do nothing;
alter table public.keepalive enable row level security;
drop policy if exists "keepalive read" on public.keepalive;
create policy "keepalive read" on public.keepalive for select to anon using (true);
grant select on public.keepalive to anon;
