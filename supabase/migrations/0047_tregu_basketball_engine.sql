-- 0047 — Basketball engine: restore sport geometry + the entity/logo registry.
--
-- The generic sport engine (0011) is already classification-ready: 0029 added
-- 'live_basketball' to markets_market_classification_check and 0031's
-- markets_live_event_check accepts provider 'espn' (NBA, FIBA windows) or
-- 'fbk' (Federata e Basketbollit të Kosovës — manual/own-source scoring).
-- apply_sport_market_oracle, settle_due_sport_markets and
-- place_sport_market_bet are provider- and sport-agnostic.
--
-- Basketball needs NO new outcome geometry: 0032's constraint already allows
-- 2–3 outcomes for every non-F1 market (basketball's moneyline is HOME/AWAY,
-- no draw). An earlier draft of this migration dropped that constraint and
-- re-added a stricter one — this file restores 0032's exact rule verbatim,
-- because the failed runs had left the table unprotected.
--
-- What this file actually adds: a trigger enforcing distinct outcome keys and
-- a 1:1 outcome_quantities mapping (rules no CHECK can express without
-- subqueries), and the league/team registry with logos. Postgres CHECK
-- constraints cannot contain subqueries — hence the trigger.

-- ── 1. Restore the sport-outcome geometry (0032 verbatim) ───────────────────
alter table public.markets drop constraint if exists markets_sport_outcomes_check;
alter table public.markets add constraint markets_sport_outcomes_check check (
  sport_outcomes is null
  or (market_type = 'f1_race_winner' and jsonb_typeof(sport_outcomes) = 'array' and jsonb_array_length(sport_outcomes) between 20 and 22)
  or (market_type <> 'f1_race_winner' and jsonb_typeof(sport_outcomes) = 'array' and jsonb_array_length(sport_outcomes) between 2 and 3)
);

-- Distinct outcome keys, and outcome_quantities keyed 1:1 with outcomes — the
-- part a CHECK cannot express without subqueries.
create or replace function public.validate_sport_market_geometry() returns trigger
language plpgsql as $$
declare
  v_keys int;
  v_distinct int;
begin
  if new.sport_outcomes is null then
    return new;
  end if;

  select count(*), count(distinct value->>'key')
  into v_keys, v_distinct
  from jsonb_array_elements(new.sport_outcomes) value;

  if v_keys <> v_distinct then
    raise exception 'sport_outcomes ka çelësa të përsëritur';
  end if;

  if new.outcome_quantities is not null then
    if (select count(*) from jsonb_object_keys(new.outcome_quantities)) <> v_keys then
      raise exception 'outcome_quantities nuk përputhet me sport_outcomes';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_markets_sport_geometry on public.markets;
create trigger trg_markets_sport_geometry
  before insert or update of sport_outcomes, outcome_quantities on public.markets
  for each row execute function public.validate_sport_market_geometry();

-- ── 2. Entity registry: leagues and teams, with logos ──────────────────────
create table if not exists public.sport_entities (
  id bigint generated always as identity primary key,
  sport text not null check (sport in ('football', 'basketball', 'f1')),
  competition text not null,              -- ESPN league key or provider key
  kind text not null check (kind in ('league', 'team')),
  name text not null,
  abbrev text not null,                   -- ESPN abbrev, country code, or slug
  logo_url text,                          -- null → UI renders a monogram
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (competition, kind, abbrev)
);
create index if not exists sport_entities_lookup on sport_entities (sport, competition, kind);

alter table public.sport_entities enable row level security;
drop policy if exists "sport entities are public" on public.sport_entities;
create policy "sport entities are public" on public.sport_entities
  for select using (true);

-- ── 3. Seeds ─────────────────────────────────────────────────────────────────
-- NBA — ESPN franchise logos: a.espncdn.com/i/teamlogos/nba/500/{abbrev}.png
insert into public.sport_entities (sport, competition, kind, name, abbrev, logo_url) values
  ('basketball', 'nba', 'league', 'National Basketball Association', 'nba', 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png'),
  ('basketball', 'nba', 'team', 'Atlanta Hawks', 'atl', 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png'),
  ('basketball', 'nba', 'team', 'Boston Celtics', 'bos', 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png'),
  ('basketball', 'nba', 'team', 'Brooklyn Nets', 'bkn', 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png'),
  ('basketball', 'nba', 'team', 'Charlotte Hornets', 'cha', 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png'),
  ('basketball', 'nba', 'team', 'Chicago Bulls', 'chi', 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png'),
  ('basketball', 'nba', 'team', 'Cleveland Cavaliers', 'cle', 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png'),
  ('basketball', 'nba', 'team', 'Dallas Mavericks', 'dal', 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png'),
  ('basketball', 'nba', 'team', 'Denver Nuggets', 'den', 'https://a.espncdn.com/i/teamlogos/nba/500/den.png'),
  ('basketball', 'nba', 'team', 'Detroit Pistons', 'det', 'https://a.espncdn.com/i/teamlogos/nba/500/det.png'),
  ('basketball', 'nba', 'team', 'Golden State Warriors', 'gs', 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png'),
  ('basketball', 'nba', 'team', 'Houston Rockets', 'hou', 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png'),
  ('basketball', 'nba', 'team', 'Indiana Pacers', 'ind', 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png'),
  ('basketball', 'nba', 'team', 'LA Clippers', 'lac', 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png'),
  ('basketball', 'nba', 'team', 'Los Angeles Lakers', 'lal', 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png'),
  ('basketball', 'nba', 'team', 'Memphis Grizzlies', 'mem', 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png'),
  ('basketball', 'nba', 'team', 'Miami Heat', 'mia', 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png'),
  ('basketball', 'nba', 'team', 'Milwaukee Bucks', 'mil', 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png'),
  ('basketball', 'nba', 'team', 'New Orleans Pelicans', 'no', 'https://a.espncdn.com/i/teamlogos/nba/500/no.png'),
  ('basketball', 'nba', 'team', 'New York Knicks', 'ny', 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png'),
  ('basketball', 'nba', 'team', 'Oklahoma City Thunder', 'okc', 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png'),
  ('basketball', 'nba', 'team', 'Orlando Magic', 'orl', 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png'),
  ('basketball', 'nba', 'team', 'Philadelphia 76ers', 'phi', 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png'),
  ('basketball', 'nba', 'team', 'Phoenix Suns', 'phx', 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png'),
  ('basketball', 'nba', 'team', 'Portland Trail Blazers', 'por', 'https://a.espncdn.com/i/teamlogos/nba/500/por.png'),
  ('basketball', 'nba', 'team', 'Sacramento Kings', 'sac', 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png'),
  ('basketball', 'nba', 'team', 'San Antonio Spurs', 'sa', 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png'),
  ('basketball', 'nba', 'team', 'Toronto Raptors', 'tor', 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png'),
  ('basketball', 'nba', 'team', 'Utah Jazz', 'utah', 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png'),
  ('basketball', 'nba', 'team', 'Washington Wizards', 'was', 'https://a.espncdn.com/i/teamlogos/nba/500/was.png')
on conflict (competition, kind, abbrev) do nothing;

-- FIBA — national teams through ESPN's country-logo CDN
-- (a.espncdn.com/i/teamlogos/countries/500/{code}.png). Kosovo's mark is live.
insert into public.sport_entities (sport, competition, kind, name, abbrev, logo_url) values
  ('basketball', 'fiba.world', 'league', 'FIBA', 'fiba.world', null),
  ('basketball', 'fiba.world', 'team', 'Kosovo', 'kos', 'https://a.espncdn.com/i/teamlogos/countries/500/kos.png'),
  ('basketball', 'fiba.world', 'team', 'United States', 'usa', 'https://a.espncdn.com/i/teamlogos/countries/500/usa.png'),
  ('basketball', 'fiba.world', 'team', 'Spain', 'esp', 'https://a.espncdn.com/i/teamlogos/countries/500/esp.png'),
  ('basketball', 'fiba.world', 'team', 'France', 'fra', 'https://a.espncdn.com/i/teamlogos/countries/500/fra.png'),
  ('basketball', 'fiba.world', 'team', 'Germany', 'ger', 'https://a.espncdn.com/i/teamlogos/countries/500/ger.png'),
  ('basketball', 'fiba.world', 'team', 'Italy', 'ita', 'https://a.espncdn.com/i/teamlogos/countries/500/ita.png'),
  ('basketball', 'fiba.world', 'team', 'Greece', 'gre', 'https://a.espncdn.com/i/teamlogos/countries/500/gre.png'),
  ('basketball', 'fiba.world', 'team', 'Lithuania', 'ltu', 'https://a.espncdn.com/i/teamlogos/countries/500/ltu.png'),
  ('basketball', 'fiba.world', 'team', 'Serbia', 'srb', 'https://a.espncdn.com/i/teamlogos/countries/500/srb.png'),
  ('basketball', 'fiba.world', 'team', 'Slovenia', 'slo', 'https://a.espncdn.com/i/teamlogos/countries/500/slo.png'),
  ('basketball', 'fiba.world', 'team', 'Turkey', 'tur', 'https://a.espncdn.com/i/teamlogos/countries/500/tur.png'),
  ('basketball', 'fiba.world', 'team', 'Canada', 'can', 'https://a.espncdn.com/i/teamlogos/countries/500/can.png'),
  ('basketball', 'fiba.world', 'team', 'Australia', 'aus', 'https://a.espncdn.com/i/teamlogos/countries/500/aus.png'),
  ('basketball', 'fiba.world', 'team', 'Argentina', 'arg', 'https://a.espncdn.com/i/teamlogos/countries/500/arg.png'),
  ('basketball', 'fiba.world', 'team', 'Brazil', 'bra', 'https://a.espncdn.com/i/teamlogos/countries/500/bra.png'),
  ('basketball', 'fiba.world', 'team', 'Albania', 'alb', 'https://a.espncdn.com/i/teamlogos/countries/500/alb.png')
on conflict (competition, kind, abbrev) do nothing;

-- Superliga e Kosovës në Basketboll — provider 'fbk'. No public canonical
-- marks exist; logo_url stays null and the UI renders monogram badges.
insert into public.sport_entities (sport, competition, kind, name, abbrev, logo_url) values
  ('basketball', 'fbk.kosovo', 'league', 'Superliga e Kosovës në Basketboll', 'fbk.kosovo', null),
  ('basketball', 'fbk.kosovo', 'team', 'Trepça', 'trepca', null),
  ('basketball', 'fbk.kosovo', 'team', 'Sigal Prishtina', 'prishtina', null),
  ('basketball', 'fbk.kosovo', 'team', 'Peja', 'peja', null),
  ('basketball', 'fbk.kosovo', 'team', 'Bashkimi', 'bashkimi', null),
  ('basketball', 'fbk.kosovo', 'team', 'Vëllaznimi', 'vellaznimi', null),
  ('basketball', 'fbk.kosovo', 'team', 'Ylli', 'ylli', null),
  ('basketball', 'fbk.kosovo', 'team', 'Golden Eagle Ylli', 'geylli', null),
  ('basketball', 'fbk.kosovo', 'team', 'Proton Cable Prizreni', 'prizreni', null),
  ('basketball', 'fbk.kosovo', 'team', 'Kastrioti', 'kastrioti', null),
  ('basketball', 'fbk.kosovo', 'team', 'Rahoveci', 'rahoveci', null)
on conflict (competition, kind, abbrev) do nothing;
