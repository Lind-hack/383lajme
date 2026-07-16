-- 0004 — Tregu news-driven virtual-market automation.
--
-- This migration does not touch profiles, balances, positions, transactions,
-- q_yes, q_no, or b. 383C remains a virtual, educational market only.
--
-- Automation may create drafts and publish news-reference snapshots; only an
-- administrator can open a draft. A market with fresh relevant news is first
-- moved to `stale`, which makes place_bet reject it, and is reopened only after
-- a successful auditable reference snapshot is written.

alter table public.markets
  add column if not exists last_news_at timestamptz,
  add column if not exists last_reference_at timestamptz;

alter table public.markets drop constraint if exists markets_status_check;
alter table public.markets
  add constraint markets_status_check
  check (status in ('draft', 'open', 'stale', 'closed', 'resolved'));

alter table public.market_snapshots
  add column if not exists reference_probability numeric,
  add column if not exists oracle_kind text,
  add column if not exists oracle_reasoning text,
  add column if not exists evidence_slugs text[] not null default '{}';

alter table public.market_snapshots drop constraint if exists market_snapshots_reference_probability_check;
alter table public.market_snapshots
  add constraint market_snapshots_reference_probability_check
  check (reference_probability is null or (reference_probability >= 0 and reference_probability <= 1));

create table if not exists public.market_automation_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  action text not null check (action in ('daily_drafts', 'reprice')),
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  details jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.market_automation_runs enable row level security;

-- Stale markets remain visible so users can inspect their paused state and
-- evidence, but place_bet continues to require status = 'open'.
drop policy if exists "open/closed/resolved markets are public" on public.markets;
create policy "public non-draft markets are visible"
  on public.markets for select
  using (status in ('open', 'stale', 'closed', 'resolved'));

-- Strengthen the invariant at the database boundary, even if a caller bypasses
-- the API route. This changes no balances or LMSR holdings.
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
begin
  if v_user is null then raise exception 'Duhet të jesh i kyçur'; end if;
  if p_side not in ('PO', 'JO') then raise exception 'Anë e pavlefshme'; end if;
  if p_coins <= 0 then raise exception 'Shuma duhet të jetë pozitive'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'Tregu nuk u gjet'; end if;
  if v_market.status = 'stale' then
    raise exception 'Tregu është pezulluar derisa të verifikohen lajmet e reja';
  end if;
  if v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;

  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < p_coins then raise exception 'Nuk ke monedha të mjaftueshme'; end if;

  v_exp_yes := exp(v_market.q_yes / v_market.b);
  v_exp_no := exp(v_market.q_no / v_market.b);
  v_sum_before := v_exp_yes + v_exp_no;
  if p_side = 'PO' then
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_no) / v_exp_yes);
    v_new_q_yes := v_market.q_yes + v_delta; v_new_q_no := v_market.q_no;
  else
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_yes) / v_exp_no);
    v_new_q_yes := v_market.q_yes; v_new_q_no := v_market.q_no + v_delta;
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
  return query select v_delta, public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);
end;
$$;

grant execute on function public.place_bet(uuid, text, numeric) to authenticated;
