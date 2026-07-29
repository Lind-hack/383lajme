-- Reusable football market contract:
-- 3 outcomes for regulation-time match result; 2 outcomes only for a
-- decisive knockout qualification market. Existing legacy rows remain valid.

alter table public.markets drop constraint if exists markets_live_event_check;
alter table public.markets add constraint markets_live_event_check check (
  live_event is null
  or (
    market_classification = 'live_football'
    and live_event->>'provider' = 'espn'
    and coalesce(live_event->>'event_id', '') <> ''
    and coalesce(live_event->>'league', '') <> ''
    and (
      (
        coalesce(live_event->>'home_team', '') <> ''
        and coalesce(live_event->>'away_team', '') <> ''
      )
      or coalesce(live_event->>'yes_team', '') <> ''
    )
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
    and (
      market_type = 'f1_race_winner'
      or (
        coalesce(live_event->>'driver_code', '') ~ '^[A-Z]{3}$'
        and coalesce(live_event->>'team', '') <> ''
      )
    )
  )
);

alter table public.markets drop constraint if exists markets_outcome_check;
alter table public.markets add constraint markets_outcome_check check (
  outcome is null
  or (market_type = 'binary' and outcome in ('PO', 'JO'))
  or (
    market_type in ('two_outcome', 'three_outcome', 'f1_race_winner')
    and live_event is not null
    and sport_outcomes is not null
    and sport_outcomes @> jsonb_build_array(jsonb_build_object('key', outcome))
  )
);
