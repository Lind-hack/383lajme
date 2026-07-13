-- 0003 — Tregu trading layer: per-trade price history, activity feed,
-- resolution rules, and LMSR sell (cash-out).
--
-- Run once in the Supabase SQL editor (Project → SQL Editor → paste → Run).
-- Idempotent — safe to run more than once.
--
-- Why: the chart previously fed on sparse AI snapshots (market_snapshots).
-- Polymarket-style charts need one price point per trade, and the market page
-- needs an activity feed — both come from the new market_trades table, written
-- inside the same transaction as the bet/sell itself.

-- ============================================================================
-- 1. market_trades — one row per executed buy/sell, doubles as price history
--    (price_yes after the trade) and the anonymized activity feed.
--    user_id references profiles (not auth.users) so PostgREST can embed
--    display_name for the feed.
-- ============================================================================

create table if not exists public.market_trades (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('buy', 'sell')),
  side text not null check (side in ('PO', 'JO')),
  coins numeric not null,       -- coins spent (buy) or received (sell)
  shares numeric not null,
  price_yes numeric not null,   -- LMSR PO price AFTER this trade, 0..1
  created_at timestamptz not null default now()
);

create index if not exists market_trades_market_time_idx
  on public.market_trades (market_id, created_at);

alter table public.market_trades enable row level security;

drop policy if exists "trades are public" on public.market_trades;
create policy "trades are public"
  on public.market_trades for select
  using (true);

-- No insert/update/delete policies — rows are written only by the
-- SECURITY DEFINER RPCs below.

-- ============================================================================
-- 2. Resolution rules — the trust surface every market must state before
--    real coins ride on it. Backfilled as NULL for existing markets; the
--    detail page falls back to a generic ruleset until the admin fills it.
-- ============================================================================

alter table public.markets
  add column if not exists resolution_rules text,
  add column if not exists resolution_source text;

-- ============================================================================
-- 3. Allow 'sell' in the coin ledger
-- ============================================================================

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal', 'sell'));

-- ============================================================================
-- 4. place_bet — same LMSR buy as before, now also logs the trade row
-- ============================================================================

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
  v_new_price numeric;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;
  if p_side not in ('PO', 'JO') then
    raise exception 'Anë e pavlefshme';
  end if;
  if p_coins <= 0 then
    raise exception 'Shuma duhet të jetë pozitive';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then
    raise exception 'Tregu nuk është i hapur';
  end if;
  if v_market.closes_at <= now() then
    raise exception 'Tregu është mbyllur';
  end if;

  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then
    raise exception 'Nuk ke monedha të mjaftueshme';
  end if;

  v_exp_yes := exp(v_market.q_yes / v_market.b);
  v_exp_no  := exp(v_market.q_no / v_market.b);
  v_sum_before := v_exp_yes + v_exp_no;

  if p_side = 'PO' then
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_no) / v_exp_yes);
    v_new_q_yes := v_market.q_yes + v_delta;
    v_new_q_no  := v_market.q_no;
  else
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_yes) / v_exp_no);
    v_new_q_yes := v_market.q_yes;
    v_new_q_no  := v_market.q_no + v_delta;
  end if;

  v_new_price := public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);

  update public.markets
    set q_yes = v_new_q_yes, q_no = v_new_q_no, updated_at = now()
    where id = p_market_id;

  update public.profiles set coins = coins - p_coins where id = v_user;

  insert into public.positions (user_id, market_id, side, shares, coins_staked)
    values (v_user, p_market_id, p_side, v_delta, p_coins)
    on conflict (user_id, market_id, side)
    do update set shares = public.positions.shares + excluded.shares,
                  coins_staked = public.positions.coins_staked + excluded.coins_staked,
                  updated_at = now();

  insert into public.transactions (user_id, type, amount, market_id, meta)
    values (v_user, 'bet', -p_coins, p_market_id, jsonb_build_object('side', p_side, 'shares', v_delta));

  insert into public.market_trades (market_id, user_id, action, side, coins, shares, price_yes)
    values (p_market_id, v_user, 'buy', p_side, p_coins, v_delta, v_new_price);

  return query select v_delta, v_new_price;
end;
$$;

-- ============================================================================
-- 5. sell_shares — LMSR cash-out: shares in, coins out, price moves back.
--    Coins received = C(q_before) - C(q_after) where C is the LMSR cost
--    function b*ln(e^(qy/b) + e^(qn/b)) and the chosen side's q decreases.
--    Cost basis (coins_staked) is reduced proportionally so P/L stays honest.
-- ============================================================================

create or replace function public.sell_shares(p_market_id uuid, p_side text, p_shares numeric)
returns table (coins_received numeric, new_price_yes numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_market record;
  v_position record;
  v_shares numeric;
  v_cost_before numeric;
  v_cost_after numeric;
  v_coins_out numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_new_price numeric;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;
  if p_side not in ('PO', 'JO') then
    raise exception 'Anë e pavlefshme';
  end if;
  if p_shares <= 0 then
    raise exception 'Numri i aksioneve duhet të jetë pozitiv';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then
    raise exception 'Tregu nuk është i hapur';
  end if;

  select * into v_position from public.positions
    where user_id = v_user and market_id = p_market_id and side = p_side
    for update;
  if not found or v_position.shares <= 0 then
    raise exception 'Nuk ke pozicion në këtë anë';
  end if;

  -- Clamp so "sell all" never fails on a float hair.
  v_shares := least(p_shares, v_position.shares);

  v_cost_before := v_market.b * ln(exp(v_market.q_yes / v_market.b) + exp(v_market.q_no / v_market.b));

  if p_side = 'PO' then
    v_new_q_yes := v_market.q_yes - v_shares;
    v_new_q_no  := v_market.q_no;
  else
    v_new_q_yes := v_market.q_yes;
    v_new_q_no  := v_market.q_no - v_shares;
  end if;

  v_cost_after := v_market.b * ln(exp(v_new_q_yes / v_market.b) + exp(v_new_q_no / v_market.b));
  v_coins_out := greatest(0, v_cost_before - v_cost_after);
  v_new_price := public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);

  update public.markets
    set q_yes = v_new_q_yes, q_no = v_new_q_no, updated_at = now()
    where id = p_market_id;

  update public.profiles set coins = coins + v_coins_out where id = v_user;

  update public.positions
    set coins_staked = greatest(0, coins_staked * (1 - v_shares / shares)),
        shares = shares - v_shares,
        updated_at = now()
    where id = v_position.id;

  insert into public.transactions (user_id, type, amount, market_id, meta)
    values (v_user, 'sell', v_coins_out, p_market_id,
            jsonb_build_object('side', p_side, 'shares', v_shares));

  insert into public.market_trades (market_id, user_id, action, side, coins, shares, price_yes)
    values (p_market_id, v_user, 'sell', p_side, v_coins_out, v_shares, v_new_price);

  return query select v_coins_out, v_new_price;
end;
$$;

grant execute on function public.sell_shares(uuid, text, numeric) to authenticated;
