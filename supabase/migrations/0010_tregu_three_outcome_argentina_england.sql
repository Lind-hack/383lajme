-- 0010 — Draft-only schema support for the verified ESPN England–Argentina three-outcome market.
-- Do not apply this migration in this change. Existing binary PO/JO rows and RPC callers remain supported.
-- 383C is a virtual in-product balance; this migration creates no real-money capability.

alter table public.markets
  add column if not exists market_type text not null default 'binary',
  add column if not exists q_england numeric not null default 0,
  add column if not exists q_draw numeric not null default 0,
  add column if not exists q_argentina numeric not null default 0,
  add column if not exists outcomes text[] not null default array['PO', 'JO']::text[],
  add column if not exists pre_match_analysis jsonb not null default '{}'::jsonb;

alter table public.markets drop constraint if exists markets_market_type_check;
alter table public.markets add constraint markets_market_type_check check (market_type in ('binary', 'three_outcome'));
alter table public.markets drop constraint if exists markets_outcome_check;
alter table public.markets add constraint markets_outcome_check check (outcome is null or outcome in ('PO', 'JO', 'ENGLAND', 'DRAW', 'ARGENTINA'));
alter table public.markets drop constraint if exists markets_outcomes_match_type_check;
alter table public.markets add constraint markets_outcomes_match_type_check check (
  (market_type = 'binary' and outcomes = array['PO', 'JO']::text[])
  or (market_type = 'three_outcome' and outcomes = array['ENGLAND', 'DRAW', 'ARGENTINA']::text[])
);
alter table public.markets drop constraint if exists markets_three_outcome_espn_check;
alter table public.markets add constraint markets_three_outcome_espn_check check (
  market_type <> 'three_outcome' or (
    live_event->>'provider' = 'espn'
    and live_event->>'event_id' = '760515'
    and live_event->>'kickoff' = '2026-07-15T19:00:00.000Z'
  )
);

alter table public.positions drop constraint if exists positions_side_check;
alter table public.positions add constraint positions_side_check check (side in ('PO', 'JO', 'ENGLAND', 'DRAW', 'ARGENTINA'));

-- Numerically stable normalized LMSR prices. The three prices always sum to one.
create or replace function public.lmsr_three_outcome_prices(p_q_england numeric, p_q_draw numeric, p_q_argentina numeric, p_b numeric)
returns jsonb language sql immutable as $$
  with quantities as (
    select greatest(p_q_england, p_q_draw, p_q_argentina) as pivot
  ), weights as (
    select exp((p_q_england - pivot) / p_b) as england, exp((p_q_draw - pivot) / p_b) as draw, exp((p_q_argentina - pivot) / p_b) as argentina from quantities
  )
  select jsonb_build_object('england', england / (england + draw + argentina), 'draw', draw / (england + draw + argentina), 'argentina', argentina / (england + draw + argentina)) from weights;
$$;

-- Separate RPC prevents any binary PO/JO behavior or response contract changing.
create or replace function public.place_three_outcome_bet(p_market_id uuid, p_side text, p_coins numeric)
returns table (shares_bought numeric, prices jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_market record; v_balance numeric; v_weights numeric[]; v_sum numeric; v_other numeric; v_index integer; v_delta numeric;
  v_england numeric; v_draw numeric; v_argentina numeric; v_volume numeric;
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_side not in ('PO', 'JO', 'ENGLAND', 'DRAW', 'ARGENTINA') then raise exception 'Anë e pavlefshme'; end if;
  if p_side not in ('ENGLAND', 'DRAW', 'ARGENTINA') then raise exception 'Ky treg kërkon England, Draw ose Argentina'; end if;
  if p_coins <= 0 then raise exception 'Shuma virtuale 383C duhet të jetë pozitive'; end if;
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.market_type <> 'three_outcome' then raise exception 'Tregu PO/JO përdor place_bet'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;
  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;
  v_weights := array[exp((v_market.q_england - greatest(v_market.q_england, v_market.q_draw, v_market.q_argentina)) / v_market.b), exp((v_market.q_draw - greatest(v_market.q_england, v_market.q_draw, v_market.q_argentina)) / v_market.b), exp((v_market.q_argentina - greatest(v_market.q_england, v_market.q_draw, v_market.q_argentina)) / v_market.b)];
  v_index := case p_side when 'ENGLAND' then 1 when 'DRAW' then 2 else 3 end;
  v_sum := v_weights[1] + v_weights[2] + v_weights[3]; v_other := v_sum - v_weights[v_index];
  v_delta := v_market.b * ln((v_sum * exp(p_coins / v_market.b) - v_other) / v_weights[v_index]);
  v_england := v_market.q_england + case when v_index = 1 then v_delta else 0 end;
  v_draw := v_market.q_draw + case when v_index = 2 then v_delta else 0 end;
  v_argentina := v_market.q_argentina + case when v_index = 3 then v_delta else 0 end;
  update public.markets set q_england = v_england, q_draw = v_draw, q_argentina = v_argentina, updated_at = now() where id = p_market_id;
  update public.profiles set coins = coins - p_coins where id = v_user;
  insert into public.positions (user_id, market_id, side, shares, coins_staked) values (v_user, p_market_id, p_side, v_delta, p_coins) on conflict (user_id, market_id, side) do update set shares = public.positions.shares + excluded.shares, coins_staked = public.positions.coins_staked + excluded.coins_staked, updated_at = now();
  insert into public.transactions (user_id, type, amount, market_id, meta) values (v_user, 'bet', -p_coins, p_market_id, jsonb_build_object('side', p_side, 'shares', v_delta, 'currency', '383C_virtual'));
  select coalesce(sum(abs(amount)), 0) into v_volume from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (market_id, oracle_kind, market_prob, volume, evidence) values (p_market_id, 'trade', (public.lmsr_three_outcome_prices(v_england, v_draw, v_argentina, v_market.b)->>'england')::numeric, v_volume, jsonb_build_array(jsonb_build_object('prices', public.lmsr_three_outcome_prices(v_england, v_draw, v_argentina, v_market.b), 'side', p_side)));
  return query select v_delta, public.lmsr_three_outcome_prices(v_england, v_draw, v_argentina, v_market.b);
end;
$$;
revoke all on function public.place_three_outcome_bet(uuid, text, numeric) from public, anon;
grant execute on function public.place_three_outcome_bet(uuid, text, numeric) to authenticated;

-- Applying official live updates for this market must use a three-way bounded oracle and
-- resolve only on ESPN FULL_TIME/FT; no new user ledger writes occur in the oracle path.
create or replace function public.apply_three_outcome_live_score_oracle(p_market_id uuid, p_provider text, p_event_id text, p_state jsonb, p_prices jsonb, p_evidence jsonb, p_close_market boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_market record; v_current jsonb; v_target_england numeric; v_target_draw numeric; v_target_argentina numeric; v_total numeric;
begin
  if p_provider <> 'espn' or p_event_id <> '760515' then raise exception 'Kërkohet eventi zyrtar ESPN 760515'; end if;
  if p_close_market and not (coalesce(p_state->>'status','') ~* '(FINAL|FULL_TIME)' or upper(trim(coalesce(p_state->>'detail',''))) = 'FT') then raise exception 'Vetëm FULL_TIME/FT mund ta mbyllë tregun'; end if;
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.market_type <> 'three_outcome' or v_market.status <> 'open' then raise exception 'Tregu tre-rezultatësh nuk është i hapur'; end if;
  if v_market.live_event->>'event_id' <> p_event_id or v_market.live_score_state->>'key' = p_state->>'key' then return; end if;
  if coalesce((p_prices->>'england')::numeric, -1) < 0 or coalesce((p_prices->>'draw')::numeric, -1) < 0 or coalesce((p_prices->>'argentina')::numeric, -1) < 0 then raise exception 'Çmimet ESPN duhet të jenë jo-negative'; end if;
  if abs(((p_prices->>'england')::numeric + (p_prices->>'draw')::numeric + (p_prices->>'argentina')::numeric) - 1) > 0.000001 then raise exception 'Çmimet e oracle duhet të bëjnë 100 për qind'; end if;
  v_current := public.lmsr_three_outcome_prices(v_market.q_england, v_market.q_draw, v_market.q_argentina, v_market.b);
  v_target_england := least((v_current->>'england')::numeric + 0.10, greatest((v_current->>'england')::numeric - 0.10, (p_prices->>'england')::numeric));
  v_target_draw := least((v_current->>'draw')::numeric + 0.10, greatest((v_current->>'draw')::numeric - 0.10, (p_prices->>'draw')::numeric));
  v_target_argentina := least((v_current->>'argentina')::numeric + 0.10, greatest((v_current->>'argentina')::numeric - 0.10, (p_prices->>'argentina')::numeric));
  v_total := v_target_england + v_target_draw + v_target_argentina;
  v_target_england := v_target_england / v_total; v_target_draw := v_target_draw / v_total; v_target_argentina := v_target_argentina / v_total;
  update public.markets set q_england = v_market.b * ln(v_target_england), q_draw = v_market.b * ln(v_target_draw), q_argentina = v_market.b * ln(v_target_argentina), live_score_state = p_state, status = case when p_close_market then 'closed' else 'open' end, closes_at = case when p_close_market then least(closes_at, now()) else closes_at end, updated_at = now() where id = p_market_id;
  insert into public.market_snapshots (market_id, oracle_kind, market_prob, reference_probability, oracle_cap, evidence, oracle_reasoning) values (p_market_id, 'live_score', v_target_england, (p_prices->>'england')::numeric, 0.10, p_evidence, 'Official ESPN score/status audit update; bounded three-outcome LMSR change with no 383C ledger mutation.');
end;
$$;
revoke all on function public.apply_three_outcome_live_score_oracle(uuid, text, text, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.apply_three_outcome_live_score_oracle(uuid, text, text, jsonb, jsonb, jsonb, boolean) to service_role;
