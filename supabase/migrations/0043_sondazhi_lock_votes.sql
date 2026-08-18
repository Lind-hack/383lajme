-- Sondazhi i Ditës — close the poll_votes read path for good.
--
-- 0042 dropped `poll_votes_public_read` by name and assumed that was the only
-- thing granting anonymous SELECT. It was not: after 0042 applied cleanly, an
-- anon-key request to
--
--   /rest/v1/poll_votes?select=voter_id&limit=3
--
-- still returned other visitors' uuids. The permissive policy on that table was
-- created by hand, out of version control, under some other name — which is the
-- same reason 0042 could not assume the column types either.
--
-- So this stops naming things it cannot see. It enumerates whatever SELECT
-- policies exist on the table and drops all of them, then re-asserts the two
-- the feature actually wants: insert for anyone, read for nobody. Reads go
-- through sondazhi_day(), which is SECURITY DEFINER and returns an aggregate
-- plus the caller's own vote — never anyone else's identifier.
--
-- Idempotent: safe to re-run.

alter table public.poll_votes enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename  = 'poll_votes'
       and cmd in ('SELECT', 'ALL')
  loop
    execute format('drop policy if exists %I on public.poll_votes', pol.policyname);
    raise notice 'dropped read policy: %', pol.policyname;
  end loop;
end $$;

-- Re-assert the one write the card needs. Dropping an 'ALL' policy above may
-- have taken the insert path with it, so this is recreated unconditionally.
drop policy if exists poll_votes_public_insert on public.poll_votes;
create policy poll_votes_public_insert
  on public.poll_votes for insert
  with check (true);

-- A vote is final, which is also what the UI promises: no update, no delete.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
--
-- Expect exactly one row: poll_votes_public_insert / INSERT. Anything with
-- cmd = SELECT means a read path is still open.
-- ─────────────────────────────────────────────────────────────────────────────
select tablename, policyname, cmd, roles
  from pg_policies
 where schemaname = 'public'
   and tablename in ('poll_votes', 'daily_polls')
 order by tablename, cmd, policyname;
