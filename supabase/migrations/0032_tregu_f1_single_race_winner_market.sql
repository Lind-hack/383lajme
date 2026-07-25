-- One F1 race-winner market with a 20–22 driver outcome book.
alter table public.markets drop constraint if exists markets_market_type_check;
alter table public.markets add constraint markets_market_type_check check (market_type in ('binary','two_outcome','three_outcome','f1_race_winner'));
alter table public.markets drop constraint if exists markets_outcomes_match_type_check;
alter table public.markets add constraint markets_outcomes_match_type_check check (
  (market_type='binary' and outcomes=array['PO','JO']::text[])
  or (market_type='two_outcome' and cardinality(outcomes)=2)
  or (market_type='three_outcome' and cardinality(outcomes)=3)
  or (market_type='f1_race_winner' and cardinality(outcomes) between 20 and 22)
);
alter table public.markets drop constraint if exists markets_sport_outcomes_check;
alter table public.markets add constraint markets_sport_outcomes_check check (
  sport_outcomes is null
  or (market_type='f1_race_winner' and jsonb_typeof(sport_outcomes)='array' and jsonb_array_length(sport_outcomes) between 20 and 22)
  or (market_type <> 'f1_race_winner' and jsonb_typeof(sport_outcomes)='array' and jsonb_array_length(sport_outcomes) between 2 and 3)
);
alter table public.markets drop constraint if exists markets_live_event_check;
alter table public.markets add constraint markets_live_event_check check (
  live_event is null
  or (market_classification='live_football' and live_event->>'provider'='espn' and coalesce(live_event->>'event_id','')<>'' and coalesce(live_event->>'league','')<>'' and coalesce(live_event->>'yes_team','')<>'')
  or (market_classification='live_basketball' and live_event->>'provider' in ('espn','fbk') and coalesce(live_event->>'event_id','')<>'' and coalesce(live_event->>'yes_team','')<>'')
  or (market_classification='live_f1' and live_event->>'provider'='formula1_dashboard' and coalesce(live_event->>'event_id','') ~ '^[A-Za-z0-9_-]+$' and (market_type='f1_race_winner' or (coalesce(live_event->>'driver_code','') ~ '^[A-Z]{3}$' and coalesce(live_event->>'team','')<>'')))
);
create table if not exists public.f1_race_templates (
 id uuid primary key default gen_random_uuid(), name text not null unique, event_id text not null, drivers jsonb not null check (jsonb_typeof(drivers)='array' and jsonb_array_length(drivers) between 20 and 22), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.f1_race_templates enable row level security;
create policy "f1 templates public read" on public.f1_race_templates for select using (true);
revoke all on public.f1_race_templates from anon, authenticated;
grant select on public.f1_race_templates to anon, authenticated;
