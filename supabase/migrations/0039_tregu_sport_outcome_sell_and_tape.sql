-- Generic football outcome trading:
-- - positions and public trade rows may use configured outcome keys (home/draw/away)
-- - every sport buy/sell records the complete post-trade probability vector
-- - authenticated users can cash out a configured sport-outcome position

alter table public.positions drop constraint if exists positions_side_check;
alter table public.positions
  add constraint positions_side_check
  check (side ~ '^[A-Za-z0-9_-]{1,40}$');

alter table public.market_trades
  add column if not exists outcome_prices jsonb;

alter table public.market_trades drop constraint if exists market_trades_side_check;
alter table public.market_trades
  add constraint market_trades_side_check
  check (side ~ '^[A-Za-z0-9_-]{1,40}$');

alter table public.market_trades
  drop constraint if exists market_trades_outcome_prices_check;
alter table public.market_trades
  add constraint market_trades_outcome_prices_check
  check (outcome_prices is null or jsonb_typeof(outcome_prices) = 'object');

create or replace function public.place_sport_market_bet(
  p_market_id uuid,
  p_side text,
  p_coins numeric
)
returns table (shares_bought numeric, prices jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market record;
  v_balance numeric;
  v_current numeric;
  v_total numeric := 0;
  v_other numeric;
  v_delta numeric;
  v_pivot numeric;
  v_weight numeric;
  v_post_total numeric := 0;
  v_prices jsonb := '{}'::jsonb;
  v_post_prices jsonb := '{}'::jsonb;
  v_new_quantities jsonb;
  v_item jsonb;
  v_key text;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;
  if p_coins is null or p_coins <= 0 then
    raise exception 'Shuma virtuale 383C duhet të jetë pozitive';
  end if;

  select *
    into v_market
    from public.markets
    where id = p_market_id
    for update;

  if not found
     or v_market.status <> 'open'
     or v_market.live_event->>'provider' <> 'espn'
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_typeof(v_market.outcome_quantities) <> 'object' then
    raise exception 'Tregu sportiv nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then
    raise exception 'Tregu është mbyllur';
  end if;
  if not exists (
    select 1
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
      where outcome.value->>'key' = p_side
  ) then
    raise exception 'Rezultati sportiv është i pavlefshëm';
  end if;

  select coins
    into v_balance
    from public.profiles
    where id = v_user
    for update;
  if v_balance < p_coins then
    raise exception 'Nuk ke monedha të mjaftueshme';
  end if;

  select max((v_market.outcome_quantities->>(outcome.value->>'key'))::numeric)
    into v_pivot
    from jsonb_array_elements(v_market.sport_outcomes) outcome(value);

  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_current := exp(
      ((v_market.outcome_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
    v_prices := v_prices || jsonb_build_object(v_key, v_current);
    v_total := v_total + v_current;
  end loop;

  v_other := v_total - (v_prices->>p_side)::numeric;
  v_delta := v_market.b * ln(
    (v_total * exp(p_coins / v_market.b) - v_other) /
    (v_prices->>p_side)::numeric
  );
  v_new_quantities := jsonb_set(
    v_market.outcome_quantities,
    array[p_side],
    to_jsonb((v_market.outcome_quantities->>p_side)::numeric + v_delta)
  );

  select max((v_new_quantities->>(outcome.value->>'key'))::numeric)
    into v_pivot
    from jsonb_array_elements(v_market.sport_outcomes) outcome(value);
  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_post_total := v_post_total + exp(
      ((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
  end loop;
  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_weight := exp(
      ((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
    v_post_prices := v_post_prices ||
      jsonb_build_object(v_key, v_weight / v_post_total);
  end loop;

  update public.markets
    set outcome_quantities = v_new_quantities,
        updated_at = now()
    where id = v_market.id;

  update public.profiles
    set coins = coins - p_coins
    where id = v_user;

  insert into public.positions (
    user_id, market_id, side, shares, coins_staked
  )
  values (
    v_user, v_market.id, p_side, v_delta, p_coins
  )
  on conflict (user_id, market_id, side)
  do update
    set shares = public.positions.shares + excluded.shares,
        coins_staked = public.positions.coins_staked + excluded.coins_staked,
        updated_at = now();

  insert into public.transactions (
    user_id, type, amount, market_id, meta
  )
  values (
    v_user,
    'bet',
    -p_coins,
    v_market.id,
    jsonb_build_object(
      'side', p_side,
      'currency', '383C_virtual',
      'shares', v_delta,
      'prices', v_post_prices
    )
  );

  insert into public.market_trades (
    market_id, user_id, action, side, coins, shares, price_yes, outcome_prices
  )
  values (
    v_market.id,
    v_user,
    'buy',
    p_side,
    p_coins,
    v_delta,
    (v_post_prices->>p_side)::numeric,
    v_post_prices
  );

  return query select v_delta, v_post_prices;
end;
$$;

revoke all on function public.place_sport_market_bet(uuid, text, numeric)
  from public, anon;
grant execute on function public.place_sport_market_bet(uuid, text, numeric)
  to authenticated;

create or replace function public.sell_sport_market_shares(
  p_market_id uuid,
  p_side text,
  p_shares numeric
)
returns table (coins_received numeric, prices jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market record;
  v_position record;
  v_item jsonb;
  v_key text;
  v_shares numeric;
  v_pivot numeric;
  v_weight numeric;
  v_total numeric := 0;
  v_post_total numeric := 0;
  v_cost_before numeric;
  v_cost_after numeric;
  v_coins_out numeric;
  v_new_quantities jsonb;
  v_post_prices jsonb := '{}'::jsonb;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;
  if p_shares is null or p_shares <= 0 then
    raise exception 'Numri i aksioneve duhet të jetë pozitiv';
  end if;

  select *
    into v_market
    from public.markets
    where id = p_market_id
    for update;

  if not found
     or v_market.status <> 'open'
     or v_market.live_event->>'provider' <> 'espn'
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_typeof(v_market.outcome_quantities) <> 'object' then
    raise exception 'Tregu sportiv nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then
    raise exception 'Tregu është mbyllur';
  end if;
  if not exists (
    select 1
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
      where outcome.value->>'key' = p_side
  ) then
    raise exception 'Rezultati sportiv është i pavlefshëm';
  end if;

  select *
    into v_position
    from public.positions
    where user_id = v_user
      and market_id = v_market.id
      and side = p_side
    for update;
  if not found or v_position.shares <= 0 then
    raise exception 'Nuk ke aksione në këtë rezultat';
  end if;

  v_shares := least(p_shares, v_position.shares);

  select max((v_market.outcome_quantities->>(outcome.value->>'key'))::numeric)
    into v_pivot
    from jsonb_array_elements(v_market.sport_outcomes) outcome(value);
  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_total := v_total + exp(
      ((v_market.outcome_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
  end loop;
  v_cost_before := v_pivot + v_market.b * ln(v_total);

  v_new_quantities := jsonb_set(
    v_market.outcome_quantities,
    array[p_side],
    to_jsonb((v_market.outcome_quantities->>p_side)::numeric - v_shares)
  );

  select max((v_new_quantities->>(outcome.value->>'key'))::numeric)
    into v_pivot
    from jsonb_array_elements(v_market.sport_outcomes) outcome(value);
  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_post_total := v_post_total + exp(
      ((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
  end loop;
  v_cost_after := v_pivot + v_market.b * ln(v_post_total);
  v_coins_out := greatest(0, v_cost_before - v_cost_after);

  for v_item in
    select outcome.value
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_weight := exp(
      ((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b
    );
    v_post_prices := v_post_prices ||
      jsonb_build_object(v_key, v_weight / v_post_total);
  end loop;

  update public.markets
    set outcome_quantities = v_new_quantities,
        updated_at = now()
    where id = v_market.id;

  update public.profiles
    set coins = coins + v_coins_out
    where id = v_user;

  update public.positions
    set coins_staked = greatest(
          0,
          coins_staked * (1 - v_shares / v_position.shares)
        ),
        shares = shares - v_shares,
        updated_at = now()
    where id = v_position.id;

  insert into public.transactions (
    user_id, type, amount, market_id, meta
  )
  values (
    v_user,
    'sell',
    v_coins_out,
    v_market.id,
    jsonb_build_object(
      'side', p_side,
      'currency', '383C_virtual',
      'shares', v_shares,
      'prices', v_post_prices
    )
  );

  insert into public.market_trades (
    market_id, user_id, action, side, coins, shares, price_yes, outcome_prices
  )
  values (
    v_market.id,
    v_user,
    'sell',
    p_side,
    v_coins_out,
    v_shares,
    (v_post_prices->>p_side)::numeric,
    v_post_prices
  );

  return query select v_coins_out, v_post_prices;
end;
$$;

revoke all on function public.sell_sport_market_shares(uuid, text, numeric)
  from public, anon;
grant execute on function public.sell_sport_market_shares(uuid, text, numeric)
  to authenticated;
