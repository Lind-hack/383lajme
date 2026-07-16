-- 0011 — Generic, ESPN-mapped three-outcome sport markets. Review/apply separately; this file has no side effect by itself.
-- Oracle records are deliberately separate from virtual 383C user trades and settlements.

alter table public.markets
  add column if not exists sport_outcomes jsonb,
  add column if not exists outcome_quantities jsonb,
  add column if not exists reference_probabilities jsonb,
  add column if not exists official_final_at timestamptz,
  add column if not exists settlement_due_at timestamptz;

alter table public.markets drop constraint if exists markets_three_outcome_espn_check;
alter table public.markets add constraint markets_sport_outcomes_check check (
  sport_outcomes is null or (jsonb_typeof(sport_outcomes) = 'array' and jsonb_array_length(sport_outcomes) = 3)
);
alter table public.markets add constraint markets_sport_quantities_check check (
  outcome_quantities is null or jsonb_typeof(outcome_quantities) = 'object'
);

-- Preserve the selected England / Draw / Argentina market while making its stored book generic.
update public.markets
set sport_outcomes = jsonb_build_array(
      jsonb_build_object('key', 'home', 'label', 'England', 'team', 'England'),
      jsonb_build_object('key', 'draw', 'label', 'Draw'),
      jsonb_build_object('key', 'away', 'label', 'Argentina', 'team', 'Argentina')),
    outcome_quantities = jsonb_build_object('home', q_england, 'draw', q_draw, 'away', q_argentina)
where market_type = 'three_outcome' and live_event->>'provider' = 'espn' and sport_outcomes is null;

create table if not exists public.sport_oracle_events (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  provider text not null check (provider = 'espn'),
  event_id text not null,
  state_key text not null,
  source_url text not null,
  official_state jsonb not null,
  reference_probabilities jsonb not null,
  reasoning text not null,
  created_at timestamptz not null default now(),
  unique (market_id, state_key)
);
alter table public.sport_oracle_events enable row level security;
create policy "sport oracle events are public" on public.sport_oracle_events for select using (true);

create table if not exists public.sport_market_settlements (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null,
  shares numeric not null check (shares >= 0),
  transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now(),
  unique (market_id, user_id, side)
);
alter table public.sport_market_settlements enable row level security;
create policy "users see their sport settlements" on public.sport_market_settlements for select using (auth.uid() = user_id);

-- Generic marginal LMSR pricing: a near-certain outcome returns roughly one share per 383C, never an arbitrary negative/zero payout.
create or replace function public.place_sport_market_bet(p_market_id uuid, p_side text, p_coins numeric)
returns table (shares_bought numeric, prices jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_market record; v_balance numeric; v_current numeric; v_total numeric := 0; v_other numeric; v_delta numeric;
  v_prices jsonb := '{}'::jsonb; v_new_quantities jsonb; v_item jsonb; v_key text;
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Shuma virtuale 383C duhet të jetë pozitive'; end if;
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.live_event->>'provider' <> 'espn' then raise exception 'Tregu sportiv nuk është i hapur'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;
  if not exists (select 1 from jsonb_array_elements(v_market.sport_outcomes) value where value->>'key' = p_side) then raise exception 'Rezultati sportiv është i pavlefshëm'; end if;
  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_key := v_item->>'key'; v_current := exp(((v_market.outcome_quantities->>v_key)::numeric - (select max((v_market.outcome_quantities->>(value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) value)) / v_market.b);
    v_prices := v_prices || jsonb_build_object(v_key, v_current); v_total := v_total + v_current;
  end loop;
  v_other := v_total - (v_prices->>p_side)::numeric;
  v_delta := v_market.b * ln((v_total * exp(p_coins / v_market.b) - v_other) / (v_prices->>p_side)::numeric);
  v_new_quantities := jsonb_set(v_market.outcome_quantities, array[p_side], to_jsonb((v_market.outcome_quantities->>p_side)::numeric + v_delta));
  update public.markets set outcome_quantities = v_new_quantities, updated_at = now() where id = p_market_id;
  update public.profiles set coins = coins - p_coins where id = v_user;
  insert into public.positions (user_id, market_id, side, shares, coins_staked) values (v_user, p_market_id, p_side, v_delta, p_coins)
    on conflict (user_id, market_id, side) do update set shares = public.positions.shares + excluded.shares, coins_staked = public.positions.coins_staked + excluded.coins_staked, updated_at = now();
  insert into public.transactions (user_id, type, amount, market_id, meta) values (v_user, 'bet', -p_coins, p_market_id, jsonb_build_object('side', p_side, 'currency', '383C_virtual', 'shares', v_delta));
  return query select v_delta, v_prices;
end;
$$;
revoke all on function public.place_sport_market_bet(uuid, text, numeric) from public, anon;
grant execute on function public.place_sport_market_bet(uuid, text, numeric) to authenticated;

-- The service role provides the bounded, normalized reference. This function never writes profiles, positions, or user transactions.
create or replace function public.apply_sport_market_oracle(p_market_id uuid, p_provider text, p_event_id text, p_state jsonb, p_reference_probabilities jsonb, p_evidence jsonb, p_reasoning text, p_requested_cap numeric, p_close_market boolean, p_verified_outcome text, p_settlement_due_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v_market record; v_key text; v_sum numeric := 0; v_target jsonb := '{}'::jsonb; v_current jsonb; v_new jsonb := '{}'::jsonb; v_probability numeric; v_cap numeric;
begin
  if p_provider <> 'espn' or coalesce(p_event_id, '') = '' or coalesce(p_state->>'key', '') = '' then raise exception 'Kërkohet eventi zyrtar ESPN'; end if;
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.live_event->>'provider' <> 'espn' or v_market.live_event->>'event_id' <> p_event_id then raise exception 'Tregu sportiv nuk përputhet'; end if;
  if p_close_market and (p_verified_outcome is null or p_settlement_due_at is null) then raise exception 'Finalja zyrtare kërkon rezultat dhe kohë zgjidhjeje'; end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then return; end if;
  v_cap := least(case when p_close_market then 0.25 else 0.12 end, greatest(0.001, p_requested_cap));
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_probability := (p_reference_probabilities->>v_key)::numeric;
    if v_probability is null or v_probability < 0 or v_probability >= 1 then raise exception 'Probabilitetet duhet të jenë të fundme dhe nën 100 për qind'; end if;
    v_sum := v_sum + v_probability;
  end loop;
  if abs(v_sum - 1) > 0.000001 then raise exception 'Çmimet duhet të bëjnë 100 për qind'; end if;
  v_current := coalesce(v_market.reference_probabilities, p_reference_probabilities);
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_probability := least((v_current->>v_key)::numeric + v_cap, greatest((v_current->>v_key)::numeric - v_cap, (p_reference_probabilities->>v_key)::numeric));
    v_target := v_target || jsonb_build_object(v_key, v_probability);
  end loop;
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop v_new := v_new || jsonb_build_object(v_key, (v_target->>v_key)::numeric / (select sum(value::numeric) from jsonb_each_text(v_target))); end loop;
  update public.markets set outcome_quantities = (select jsonb_object_agg(key, v_market.b * ln(value::numeric)) from jsonb_each_text(v_new)), reference_probabilities = v_new, live_score_state = p_state, status = case when p_close_market then 'closed' else 'open' end, official_final_at = case when p_close_market then now() else official_final_at end, settlement_due_at = case when p_close_market then p_settlement_due_at else settlement_due_at end, outcome = case when p_close_market then p_verified_outcome else outcome end, closes_at = case when p_close_market then least(closes_at, now()) else closes_at end, updated_at = now() where id = p_market_id;
  insert into public.sport_oracle_events (market_id, provider, event_id, state_key, source_url, official_state, reference_probabilities, reasoning) values (p_market_id, p_provider, p_event_id, p_state->>'key', p_state->>'source_url', p_state, v_new, p_reasoning);
  insert into public.market_snapshots (market_id, oracle_kind, market_prob, reference_probability, oracle_cap, evidence, oracle_reasoning) values (p_market_id, 'sport_oracle', coalesce((v_new->>'home')::numeric, 0), coalesce((p_reference_probabilities->>'home')::numeric, 0), v_cap, p_evidence, p_reasoning);
end;
$$;
revoke all on function public.apply_sport_market_oracle(uuid, text, text, jsonb, jsonb, jsonb, text, numeric, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_sport_market_oracle(uuid, text, text, jsonb, jsonb, jsonb, text, numeric, boolean, text, timestamptz) to service_role;

-- Runs after the seven-minute verification window. The closed/resolved lock and unique settlement row make retries idempotent.
create or replace function public.settle_due_sport_markets()
returns integer language plpgsql security definer set search_path = public as $$
declare v_market record; v_position record; v_count integer := 0; v_transaction uuid;
begin
  for v_market in select * from public.markets where status = 'closed' and settlement_due_at <= now() and outcome is not null for update skip locked loop
    for v_position in select * from public.positions where market_id = v_market.id and side = v_market.outcome and shares > 0 loop
      insert into public.sport_market_settlements (market_id, user_id, side, shares) values (v_market.id, v_position.user_id, v_position.side, v_position.shares)
        on conflict (market_id, user_id, side) do nothing returning id into v_transaction;
      if v_transaction is not null then
        update public.profiles set coins = coins + v_position.shares where id = v_position.user_id;
        insert into public.transactions (user_id, type, amount, market_id, meta) values (v_position.user_id, 'payout', v_position.shares, v_market.id, jsonb_build_object('side', v_position.side, 'currency', '383C_virtual', 'settlement', 'official_espn_final')) returning id into v_transaction;
        update public.sport_market_settlements set transaction_id = v_transaction where market_id = v_market.id and user_id = v_position.user_id and side = v_position.side;
      end if;
    end loop;
    update public.markets set status = 'resolved', resolved_at = now(), updated_at = now() where id = v_market.id and status = 'closed'; v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.settle_due_sport_markets() from public, anon, authenticated;
grant execute on function public.settle_due_sport_markets() to service_role;
