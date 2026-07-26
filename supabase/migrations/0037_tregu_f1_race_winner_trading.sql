-- Atomic user trades for the single 20–22-driver virtual F1 winner market.
create or replace function public.place_f1_race_winner_bet(p_market_id uuid, p_side text, p_coins numeric)
returns table (shares_bought numeric, prices jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_market record; v_balance numeric; v_current numeric; v_total numeric := 0; v_other numeric; v_delta numeric;
  v_prices jsonb := '{}'::jsonb; v_new_quantities jsonb; v_item jsonb; v_key text; v_post_price numeric;
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Shuma virtuale 383C duhet të jetë pozitive'; end if;
  if p_side !~ '^[A-Z]{3}$' then raise exception 'Piloti i zgjedhur nuk është i vlefshëm'; end if;
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.market_classification <> 'live_f1' or v_market.market_type <> 'f1_race_winner' or v_market.live_event->>'provider' <> 'formula1_dashboard' then raise exception 'Tregu F1 nuk është i hapur'; end if;
  if v_market.closes_at is null or v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;
  if v_market.b is null or v_market.b <= 0 then raise exception 'Likuiditeti F1 nuk është konfiguruar'; end if;
  if jsonb_typeof(v_market.sport_outcomes) <> 'array' or jsonb_typeof(v_market.outcome_quantities) <> 'object' then raise exception 'Fusha F1 nuk është konfiguruar'; end if;
  if jsonb_array_length(v_market.sport_outcomes) < 20 or jsonb_array_length(v_market.sport_outcomes) > 22 then raise exception 'Fusha F1 duhet të ketë 20–22 pilotë'; end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(v_market.sport_outcomes) value) <> jsonb_array_length(v_market.sport_outcomes) then raise exception 'Pilotët F1 duhet të jenë unikë'; end if;
  if exists (select 1 from jsonb_array_elements(v_market.sport_outcomes) value where coalesce(value->>'key','') !~ '^[A-Z]{3}$') then raise exception 'Kodi i pilotit F1 nuk është i vlefshëm'; end if;
  if not exists (select 1 from jsonb_array_elements(v_market.sport_outcomes) value where value->>'key' = p_side) then raise exception 'Piloti nuk i përket këtij tregu F1'; end if;
  select coins into v_balance from public.profiles where id = v_user for update;
  if coalesce(v_balance, 0) < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_key := v_item->>'key'; if (v_market.outcome_quantities->>v_key) is null then raise exception 'Likuiditeti F1 nuk është konfiguruar'; end if;
    v_current := exp(((v_market.outcome_quantities->>v_key)::numeric - (select max((v_market.outcome_quantities->>(value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) value)) / v_market.b);
    v_prices := v_prices || jsonb_build_object(v_key, v_current); v_total := v_total + v_current;
  end loop;
  if v_total <= 0 then raise exception 'Likuiditeti F1 nuk është i vlefshëm'; end if;
  v_other := v_total - (v_prices->>p_side)::numeric;
  v_delta := v_market.b * ln((v_total * exp(p_coins / v_market.b) - v_other) / (v_prices->>p_side)::numeric);
  v_new_quantities := jsonb_set(v_market.outcome_quantities, array[p_side], to_jsonb((v_market.outcome_quantities->>p_side)::numeric + v_delta));
  v_post_price := exp(((v_new_quantities->>p_side)::numeric - (select max((v_new_quantities->>(value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) value)) / v_market.b);
  v_post_price := v_post_price / (select sum(exp(((v_new_quantities->>(value->>'key'))::numeric - (select max((v_new_quantities->>(x.value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) x)) / v_market.b)) from jsonb_array_elements(v_market.sport_outcomes) value);
  if v_post_price - ((v_prices->>p_side)::numeric / v_total) > 0.015001 then raise exception 'Kjo shumë do të lëvizte gjasën mbi kufirin 1.5pp; përdor një shumë më të vogël'; end if;
  update public.markets set outcome_quantities = v_new_quantities, updated_at = now() where id = v_market.id;
  update public.profiles set coins = coins - p_coins where id = v_user;
  insert into public.positions (user_id, market_id, side, shares, coins_staked) values (v_user, v_market.id, p_side, v_delta, p_coins) on conflict (user_id, market_id, side) do update set shares = public.positions.shares + excluded.shares, coins_staked = public.positions.coins_staked + excluded.coins_staked, updated_at = now();
  insert into public.transactions (user_id, type, amount, market_id, meta) values (v_user, 'bet', -p_coins, v_market.id, jsonb_build_object('side', p_side, 'currency', '383C_virtual', 'shares', v_delta, 'market_type', 'f1_race_winner'));
  return query select v_delta, (select jsonb_object_agg(value->>'key', exp(((v_new_quantities->>(value->>'key'))::numeric - (select max((v_new_quantities->>(x.value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) x)) / v_market.b) / (select sum(exp(((v_new_quantities->>(y.value->>'key'))::numeric - (select max((v_new_quantities->>(z.value->>'key'))::numeric) from jsonb_array_elements(v_market.sport_outcomes) z)) / v_market.b)) from jsonb_array_elements(v_market.sport_outcomes) y)) from jsonb_array_elements(v_market.sport_outcomes) value);
end;
$$;
revoke all on function public.place_f1_race_winner_bet(uuid, text, numeric) from public, anon;
grant execute on function public.place_f1_race_winner_bet(uuid, text, numeric) to authenticated;
