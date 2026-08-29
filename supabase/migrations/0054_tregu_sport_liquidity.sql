-- 0054 — Deeper sport liquidity without repricing existing positions.
--
-- Scaling every outstanding quantity by new_b / old_b keeps q / b identical,
-- therefore every pre-migration LMSR probability remains exactly unchanged.
-- Fresh 2-, 3-, and 22-outcome books then move by at most ~1.46pp for the
-- standard 100-coin quick buy. Structured sport buys also retain a hard 1.5pp
-- per-trade guard.

with sport_books as (
  select
    id,
    b as old_b,
    6500::numeric / b as liquidity_ratio
  from public.markets
  where status = 'open'
    and lower(category) = 'sport'
    and b > 0
    and b < 6500
)
update public.markets market
set
  b = 6500,
  q_yes = market.q_yes * sport_books.liquidity_ratio,
  q_no = market.q_no * sport_books.liquidity_ratio,
  outcome_quantities = case
    when jsonb_typeof(market.outcome_quantities) = 'object' then (
      select jsonb_object_agg(entry.key, to_jsonb(entry.value::numeric * sport_books.liquidity_ratio))
      from jsonb_each_text(market.outcome_quantities) entry
    )
    else market.outcome_quantities
  end
from sport_books
where market.id = sport_books.id;

alter table public.markets
  drop constraint if exists markets_open_sport_liquidity_check;
alter table public.markets
  add constraint markets_open_sport_liquidity_check
  check (status <> 'open' or lower(category) <> 'sport' or b >= 6500);

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
  v_selected_price numeric;
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
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_coins is null or p_coins <= 0 then
    raise exception 'Shuma virtuale 383C duhet të jetë pozitive';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found
     or v_market.status <> 'open'
     or v_market.market_classification not in ('live_football', 'live_basketball')
     or v_market.live_event->>'provider' not in ('espn', 'fbk')
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_typeof(v_market.outcome_quantities) <> 'object' then
    raise exception 'Tregu sportiv nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;
  if v_market.b < 6500 then raise exception 'Likuiditeti sportiv nuk është përditësuar'; end if;
  if not exists (
    select 1 from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
    where outcome.value->>'key' = p_side
  ) then
    raise exception 'Rezultati sportiv është i pavlefshëm';
  end if;

  select coins into v_balance
  from public.profiles
  where id = v_user
  for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;

  select max((v_market.outcome_quantities->>(outcome.value->>'key'))::numeric)
  into v_pivot
  from jsonb_array_elements(v_market.sport_outcomes) outcome(value);

  for v_item in select outcome.value from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_current := exp(((v_market.outcome_quantities->>v_key)::numeric - v_pivot) / v_market.b);
    v_prices := v_prices || jsonb_build_object(v_key, v_current);
    v_total := v_total + v_current;
  end loop;

  v_selected_price := (v_prices->>p_side)::numeric / v_total;
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
  for v_item in select outcome.value from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_post_total := v_post_total + exp(((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b);
  end loop;
  for v_item in select outcome.value from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
  loop
    v_key := v_item->>'key';
    v_weight := exp(((v_new_quantities->>v_key)::numeric - v_pivot) / v_market.b);
    v_post_prices := v_post_prices || jsonb_build_object(v_key, v_weight / v_post_total);
  end loop;

  if (v_post_prices->>p_side)::numeric - v_selected_price > 0.015001 then
    raise exception 'Kjo shumë do të lëvizte gjasën mbi kufirin 1.5pp; përdor një shumë më të vogël';
  end if;

  update public.markets
  set outcome_quantities = v_new_quantities, updated_at = now()
  where id = v_market.id;

  update public.profiles
  set coins = coins - p_coins
  where id = v_user;

  insert into public.positions (user_id, market_id, side, shares, coins_staked)
  values (v_user, v_market.id, p_side, v_delta, p_coins)
  on conflict (user_id, market_id, side)
  do update set
    shares = public.positions.shares + excluded.shares,
    coins_staked = public.positions.coins_staked + excluded.coins_staked,
    updated_at = now();

  insert into public.transactions (user_id, type, amount, market_id, meta)
  values (
    v_user,
    'bet',
    -p_coins,
    v_market.id,
    jsonb_build_object('side', p_side, 'currency', '383C_virtual', 'shares', v_delta, 'prices', v_post_prices)
  );

  insert into public.market_trades (market_id, user_id, action, side, coins, shares, price_yes, outcome_prices)
  values (v_market.id, v_user, 'buy', p_side, p_coins, v_delta, (v_post_prices->>p_side)::numeric, v_post_prices);

  return query select v_delta, v_post_prices;
end;
$$;

revoke all on function public.place_sport_market_bet(uuid, text, numeric) from public, anon;
grant execute on function public.place_sport_market_bet(uuid, text, numeric) to authenticated;
