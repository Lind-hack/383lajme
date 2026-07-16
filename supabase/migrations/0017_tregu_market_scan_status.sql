-- 0017 — Persist non-secret two-minute scan status for every open Tregu market.
-- The scan record is observability only. It never changes LMSR quantities,
-- balances, positions, transactions, or a market's lifecycle status.
alter table public.markets
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_scan_result jsonb;

create index if not exists markets_open_last_checked_at_idx
  on public.markets (last_checked_at desc)
  where status = 'open';
