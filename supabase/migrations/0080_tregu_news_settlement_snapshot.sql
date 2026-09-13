-- Final settlement is not a capped forecast adjustment. Migration 0069
-- accidentally excluded it, rolling back resolution and payouts together.
begin;
alter table public.market_snapshots drop constraint if exists market_snapshots_oracle_cap_check;
alter table public.market_snapshots add constraint market_snapshots_oracle_cap_check
  check (oracle_cap >= 0 and oracle_cap <= case
    when oracle_kind in ('sport_oracle', 'f1_oracle', 'verified_news_settlement') then 1.0
    else 0.10 end);
commit;
