-- 0025 — Verified decisive news movement and bounded virtual trade impact.
-- Apply ONCE in Supabase SQL Editor after the matching application code is deployed.

alter table public.market_snapshots
  add column if not exists evidence_kind text;

alter table public.market_snapshots
  drop constraint if exists market_snapshots_evidence_kind_check;
alter table public.market_snapshots
  add constraint market_snapshots_evidence_kind_check
  check (evidence_kind is null or evidence_kind in ('ordinary', 'decisive'));

alter table public.market_snapshots
  drop constraint if exists market_snapshots_oracle_cap_check;
alter table public.market_snapshots
  add constraint market_snapshots_oracle_cap_check
  check (oracle_cap is null or (oracle_cap > 0 and oracle_cap <= 0.30));

create or replace function public.apply_news_oracle(
  p_market_id uuid,
  p_reference_probability numeric,
  p_oracle_reasoning text,
  p_evidence_slugs text[],
  p_evidence jsonb,
  p_evidence_sources text[],
  p_last_news_at timestamptz,
  p_requested_cap numeric,
  p_evidence_kind text default 'ordinary'
)
returns table (new_price_yes numeric, previous_price_yes numeric, applied_cap numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_current_price numeric;
  v_target_price numeric;
  v_reference_probability numeric;
  v_cap numeric;
  v_oracle_delta numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_volume numeric;
  v_source_count integer;
begin
  if p_reference_probability is null or p_reference_probability < 0 or p_reference_probability > 1 then
    raise exception 'Probabiliteti i oracle duhet të jetë mes 0 dhe 1';
  end if;
  if coalesce(cardinality(p_evidence_slugs), 0) = 0 or coalesce(cardinality(p_evidence_sources), 0) = 0 then
    raise exception 'Oracle kërkon prova të verifikuara';
  end if;
  if p_evidence_kind not in ('ordinary', 'decisive') then
    raise exception 'Lloji i provës nuk është i vlefshëm';
  end if;

  select count(distinct lower(trim(source))) into v_source_count
    from unnest(p_evidence_sources) as source
    where trim(source) <> '';
  if v_source_count = 0 then
    raise exception 'Oracle kërkon botues të identifikueshëm';
  end if;

  if p_evidence_kind = 'decisive' then
    if v_source_count < 2 then
      raise exception 'Prova vendimtare kërkon dy burime të pavarura';
    end if;
    v_cap := least(0.30, greatest(0, coalesce(p_requested_cap, 0)));
    if v_cap <= 0.05 then
      raise exception 'Prova vendimtare kërkon kufi material';
    end if;
  else
    v_cap := least(0.05, greatest(0, coalesce(p_requested_cap, 0)));
    if v_cap = 0 then
      raise exception 'Oracle kërkon kufi pozitiv';
    end if;
    if v_cap > 0.02 and v_source_count < 2 then
      raise exception 'Lëvizjet e mëdha të oracle kërkojnë dy burime të pavarura';
    end if;
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then
    raise exception 'Tregu nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then
    raise exception 'Tregu është mbyllur';
  end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_reference_probability := case
    when p_evidence_kind = 'decisive' then least(0.99, greatest(0.01, p_reference_probability))
    else least(0.999, greatest(0.001, p_reference_probability))
  end;
  v_target_price := least(v_current_price + v_cap, greatest(v_current_price - v_cap, v_reference_probability));
  v_oracle_delta := v_market.b * (
    ln(v_target_price / (1 - v_target_price)) - ln(v_current_price / (1 - v_current_price))
  );
  v_new_q_yes := v_market.q_yes + v_oracle_delta / 2;
  v_new_q_no := v_market.q_no - v_oracle_delta / 2;

  update public.markets
    set q_yes = v_new_q_yes,
        q_no = v_new_q_no,
        last_news_at = p_last_news_at,
        last_reference_at = now(),
        updated_at = now()
    where id = p_market_id;

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = p_market_id and type = 'bet';

  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, evidence_kind, market_prob_before,
    market_prob, oracle_cap, volume
  ) values (
    p_market_id, p_reference_probability, p_reference_probability, 'news_oracle', p_oracle_reasoning,
    p_evidence_slugs, p_evidence, p_evidence_sources, p_evidence_kind, v_current_price,
    v_target_price, v_cap, v_volume
  );

  return query select v_target_price, v_current_price, v_cap;
end;
$$;

revoke all on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text) to service_role;

-- Reject a virtual bet before any market, balance, position, transaction, or chart write
-- when its price impact would exceed 3 percentage points.
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
  v_current_price numeric;
  v_new_price numeric;
  v_trade_impact numeric;
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_side not in ('PO', 'JO') then raise exception 'Anë e pavlefshme'; end if;
  if p_coins <= 0 then raise exception 'Shuma duhet të jetë pozitive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;

  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
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

  v_new_price := public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);
  v_trade_impact := abs(v_new_price - v_current_price);

  -- para se të preken bilanci, pozicionet, transaksionet ose grafiku.
  if v_trade_impact > 0.03 then
    raise exception 'Një bast mund të lëvizë maksimumi 3 pikë përqindjeje; zvogëlo shumën.';
  end if;

  update public.markets set q_yes = v_new_q_yes, q_no = v_new_q_no, updated_at = now() where id = p_market_id;
  update public.profiles set coins = coins - p_coins where id = v_user;

  insert into public.positions (user_id, market_id, side, shares, coins_staked)
    values (v_user, p_market_id, p_side, v_delta, p_coins)
    on conflict (user_id, market_id, side) do update
      set shares = public.positions.shares + excluded.shares,
          coins_staked = public.positions.coins_staked + excluded.coins_staked,
          updated_at = now();

  insert into public.transactions (user_id, type, amount, market_id, meta)
    values (v_user, 'bet', -p_coins, p_market_id, jsonb_build_object('side', p_side, 'shares', v_delta));

  insert into public.market_trades (market_id, user_id, action, side, coins, shares, price_yes)
    values (p_market_id, v_user, 'buy', p_side, p_coins, v_delta, v_new_price);

  return query select v_delta, v_new_price;
end;
$$;

grant execute on function public.place_bet(uuid, text, numeric) to authenticated;
