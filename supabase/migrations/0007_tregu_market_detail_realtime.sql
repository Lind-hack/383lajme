-- 0007 — Tregu market-detail Realtime publication setup.
--
-- SAFE SETUP ONLY: commit this file for review, then run it once through the
-- Supabase Dashboard SQL Editor or the team's migration workflow. It is not
-- executed by the application, the scheduler, or this change.
--
-- The browser still reads through existing public RLS policies. These settings
-- only make fresh public market read-model rows available to Supabase Realtime;
-- they do not grant writes and do not call any pricing, oracle, or ledger RPC.

alter table public.markets replica identity full;
alter table public.market_snapshots replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'markets'
  ) then
    alter publication supabase_realtime add table public.markets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'market_snapshots'
  ) then
    alter publication supabase_realtime add table public.market_snapshots;
  end if;
end;
$$;
