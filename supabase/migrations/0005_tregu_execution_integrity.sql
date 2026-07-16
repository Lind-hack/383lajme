-- 0005 — Tregu execution integrity and launch liquidity.
--
-- Market execution is driven only by authenticated 383C bets through LMSR.
-- News/Groq automation may write reference signals, but it must never update
-- q_yes, q_no, balances, positions, transactions, or the LMSR price.

alter table public.markets
  alter column b set default 400,
  add column if not exists resolution_criteria text;

-- Each successful bet creates the only kind of snapshot allowed to advance the
-- execution-price history. Reference snapshots are intentionally separate.
create or replace function public.place_bet(p_market_id uuid, p_side text, p_coins numeric)
returns table (shares_bought numeric, new_price_yes numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market record;
  v_balance numeric;
  v_sum_before numeric;
  v_exp_yes numeric;
  v_exp_no numeric;
  v_delta numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_new_price_yes numeric;
  v_volume numeric;
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_side not in ('PO', 'JO') then raise exception 'Anë e pavlefshme'; end if;
  if p_coins <= 0 then raise exception 'Shuma duhet të jetë pozitive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;

  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;

  v_exp_yes := exp(v_market.q_yes / v_market.b);
  v_exp_no := exp(v_market.q_no / v_market.b);
  v_sum_before := v_exp_yes + v_exp_no;
  if p_side = 'PO' then
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_no) / v_exp_yes);
    v_new_q_yes := v_market.q_yes + v_delta;
    v_new_q_no := v_market.q_no;
  else
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_yes) / v_exp_no);
    v_new_q_yes := v_market.q_yes;
    v_new_q_no := v_market.q_no + v_delta;
  end if;

  v_new_price_yes := public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);
  update public.markets
    set q_yes = v_new_q_yes, q_no = v_new_q_no, updated_at = now()
    where id = p_market_id;
  update public.profiles set coins = coins - p_coins where id = v_user;
  insert into public.positions (user_id, market_id, side, shares, coins_staked)
    values (v_user, p_market_id, p_side, v_delta, p_coins)
    on conflict (user_id, market_id, side) do update
      set shares = public.positions.shares + excluded.shares,
          coins_staked = public.positions.coins_staked + excluded.coins_staked,
          updated_at = now();
  insert into public.transactions (user_id, type, amount, market_id, meta)
    values (v_user, 'bet', -p_coins, p_market_id, jsonb_build_object('side', p_side, 'shares', v_delta));

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (market_id, ai_prob, reference_probability, oracle_kind, market_prob, volume, evidence)
    values (p_market_id, null, null, 'trade', v_new_price_yes, v_volume, null);

  return query select v_delta, v_new_price_yes;
end;
$$;

grant execute on function public.place_bet(uuid, text, numeric) to authenticated;
