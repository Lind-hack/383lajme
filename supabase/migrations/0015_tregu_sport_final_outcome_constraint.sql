-- 0015 — Permit the configured generic sport winner key at final settlement.
-- The sole three-outcome market remains the fixed ESPN England–Argentina event;
-- binary markets continue to resolve only to PO or JO.
-- This migration does not settle anything: the existing seven-minute delayed,
-- idempotent 383C settlement function remains the only payout path.

alter table public.markets drop constraint if exists markets_outcome_check;
alter table public.markets add constraint markets_outcome_check check (
  outcome is null
  or (market_type = 'binary' and outcome in ('PO', 'JO'))
  or (
    market_type = 'three_outcome'
    and live_event->>'provider' = 'espn'
    and live_event->>'event_id' = '760515'
    and outcome in ('england', 'draw', 'argentina')
  )
);
