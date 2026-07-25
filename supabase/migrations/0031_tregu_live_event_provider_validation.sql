-- Permit provider-specific live-event configuration for isolated sports markets.
alter table public.markets drop constraint if exists markets_live_event_check;
alter table public.markets add constraint markets_live_event_check check (
  live_event is null
  or (
    market_classification = 'live_football'
    and live_event->>'provider' = 'espn'
    and coalesce(live_event->>'event_id', '') <> ''
    and coalesce(live_event->>'league', '') <> ''
    and coalesce(live_event->>'yes_team', '') <> ''
  )
  or (
    market_classification = 'live_basketball'
    and live_event->>'provider' in ('espn', 'fbk')
    and coalesce(live_event->>'event_id', '') <> ''
    and coalesce(live_event->>'yes_team', '') <> ''
  )
  or (
    market_classification = 'live_f1'
    and live_event->>'provider' = 'formula1_dashboard'
    and coalesce(live_event->>'event_id', '') ~ '^[A-Za-z0-9_-]+$'
    and coalesce(live_event->>'driver_code', '') ~ '^[A-Z]{3}$'
    and coalesce(live_event->>'team', '') <> ''
  )
);
