-- 0050 — Allow authenticated traders to cash out an open F1 winner position.
--
-- F1 uses the same multi-outcome LMSR book as football, but its provider and
-- market identity are deliberately stricter. Keeping a dedicated RPC avoids
-- widening the ESPN football contract while preserving one atomic balance,
-- position, market and tape update.

create or replace function public.sell_f1_race_winner_shares(
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
     or v_market.market_classification <> 'live_f1'
     or v_market.market_type <> 'f1_race_winner'
     or v_market.live_event->>'provider' <> 'formula1_dashboard'
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_array_length(v_market.sport_outcomes) not between 20 and 22
     or jsonb_typeof(v_market.outcome_quantities) <> 'object' then
    raise exception 'Tregu F1 nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then
    raise exception 'Tregu është mbyllur';
  end if;
  if p_side !~ '^[A-Z]{3}$' or not exists (
    select 1
      from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
      where outcome.value->>'key' = p_side
  ) then
    raise exception 'Piloti i zgjedhur nuk është i vlefshëm';
  end if;

  select *
    into v_position
    from public.positions
    where user_id = v_user
      and market_id = v_market.id
      and side = p_side
    for update;
  if not found or v_position.shares <= 0 then
    raise exception 'Nuk ke aksione në këtë pilot';
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
      'prices', v_post_prices,
      'market_type', 'f1_race_winner'
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

revoke all on function public.sell_f1_race_winner_shares(uuid, text, numeric)
  from public, anon;
grant execute on function public.sell_f1_race_winner_shares(uuid, text, numeric)
  to authenticated;
