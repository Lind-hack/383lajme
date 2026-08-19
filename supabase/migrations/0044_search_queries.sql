-- Kërko — what readers looked for and did not find.
--
-- The purpose is editorial rather than analytical. A search that dead-ends is
-- the clearest brief a newsroom can get: it is a reader telling you, in their
-- own words, about something they expected you to cover. Only misses are
-- written, so the table stays a list of gaps rather than a traffic log.
--
-- No IP, no session, no identifier of any kind. A query string is enough to act
-- on and there is no reason to know who typed it.
--
-- Idempotent: safe to re-run.

create table if not exists public.search_queries (
  id          bigint generated always as identity primary key,
  query       text        not null,
  /** How many near-matches were offered instead. Zero means the reader was
      shown nothing at all, which is the most urgent case to read. */
  suggestions int         not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.search_queries is
  'Zero-result searches only. A list of what readers wanted and 383 did not have.';

-- The query is always read newest-first, and grouped to find repeats.
create index if not exists search_queries_created_idx
  on public.search_queries (created_at desc);

-- Defensive bounds: the route already truncates, but nothing stops a direct
-- call, and an unbounded text column is an invitation.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'search_queries_len_check'
  ) then
    alter table public.search_queries
      add constraint search_queries_len_check
      check (char_length(query) between 1 and 200);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
--
-- Written only by the service role, from the API route. Nothing reads it from
-- the browser: these are reader queries, and exposing them publicly would turn
-- a private search box into a public one.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.search_queries enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'search_queries'
  loop
    execute format('drop policy if exists %I on public.search_queries', pol.policyname);
  end loop;
end $$;

-- No policies at all: with RLS enabled and none defined, anon and authenticated
-- can neither read nor write, while the service role bypasses RLS entirely.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
--
-- Expect zero rows: any policy here would open the table to the browser.
-- ─────────────────────────────────────────────────────────────────────────────
select policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename = 'search_queries';
