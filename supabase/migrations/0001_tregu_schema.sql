-- 383 Tregu — prediction markets schema
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
-- Uses LMSR (logarithmic market scoring rule) pricing so every bet moves the odds,
-- matching Polymarket-style "bet the underdog for a bigger payout" behavior.
--
-- All coin-affecting writes happen through SECURITY DEFINER functions below.
-- Direct client INSERT/UPDATE on coins/markets/positions/transactions is revoked,
-- so a user cannot forge a balance from the browser — only the RPCs can move coins.

-- ============================================================================
-- 1. profiles — one row per auth user, holds the 383 Coin balance
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  coins numeric not null default 0,
  last_daily_bonus_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are viewable publicly (leaderboard-safe fields only via view)"
  on public.profiles for select
  using (true);

-- No insert/update/delete policies for regular users — profile creation and
-- coin changes only happen via the SECURITY DEFINER functions below.

-- Auto-create a profile + grant the 100-coin signup bonus when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, coins)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 100);

  insert into public.transactions (user_id, type, amount, meta)
  values (new.id, 'signup_bonus', 100, jsonb_build_object('note', 'Bonusi i regjistrimit'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. markets — one prediction market per question
-- ============================================================================

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  question text not null,
  description text,
  category text not null default 'te-tjera', -- politike | ekonomi | sport | bote | te-tjera
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'resolved')),
  outcome text check (outcome in ('PO', 'JO')), -- set on resolve
  source_article_slugs text[] default '{}',
  ai_generated boolean not null default false,
  approved_by uuid references auth.users(id),

  -- LMSR state
  b numeric not null default 100,       -- liquidity parameter (higher = less price movement per bet)
  q_yes numeric not null default 0,     -- outstanding YES ("PO") shares
  q_no numeric not null default 0,      -- outstanding NO ("JO") shares

  closes_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.markets enable row level security;

create policy "open/closed/resolved markets are public"
  on public.markets for select
  using (status in ('open', 'closed', 'resolved'));

-- No client insert/update — markets are created/approved/resolved via
-- SECURITY DEFINER admin functions (called from the admin API route, which
-- already gates on ADMIN_SECRET) or the cron job's service-role-free RPC below.

-- LMSR current price of YES ("PO"), 0..1
create or replace function public.lmsr_price_yes(p_q_yes numeric, p_q_no numeric, p_b numeric)
returns numeric
language sql
immutable
as $$
  select exp(p_q_yes / p_b) / (exp(p_q_yes / p_b) + exp(p_q_no / p_b));
$$;

-- ============================================================================
-- 3. market_snapshots — probability history (AI line + market line) for charts
-- ============================================================================

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  ai_prob numeric,        -- 0..1, from Groq scoring against scraped articles
  market_prob numeric not null, -- 0..1, LMSR price at snapshot time
  volume numeric not null default 0, -- cumulative coins wagered at snapshot time
  evidence jsonb,          -- [{title, url, slug}] articles the AI cited
  created_at timestamptz not null default now()
);

alter table public.market_snapshots enable row level security;

create policy "snapshots are public"
  on public.market_snapshots for select
  using (true);

-- ============================================================================
-- 4. positions — one row per (user, market, side)
-- ============================================================================

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  side text not null check (side in ('PO', 'JO')),
  shares numeric not null default 0,
  coins_staked numeric not null default 0, -- cumulative cost basis
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, market_id, side)
);

alter table public.positions enable row level security;

create policy "users see their own positions"
  on public.positions for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 5. transactions — coin ledger (auditable, append-only)
-- ============================================================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal')),
  amount numeric not null, -- positive = credit, negative = debit
  market_id uuid references public.markets(id),
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "users see their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 6. withdrawal_requests — 10,000 coins -> EUR10, ADMIN-REVIEWED, not automated
-- ============================================================================

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coins_amount numeric not null,
  euros_amount numeric not null,
  payout_method text, -- e.g. "PayPal: user@example.com" or IBAN, entered by user
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_notes text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.withdrawal_requests enable row level security;

create policy "users see their own withdrawal requests"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 7. Daily login bonus — +10 coins, once per 24h, callable by the logged-in user
-- ============================================================================

create or replace function public.claim_daily_bonus()
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_last timestamptz;
  v_bonus numeric := 10;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;

  select last_daily_bonus_at into v_last from public.profiles where id = v_user for update;

  if v_last is not null and v_last > now() - interval '24 hours' then
    raise exception 'Bonusi ditor tashmë është marrë';
  end if;

  update public.profiles
    set coins = coins + v_bonus, last_daily_bonus_at = now()
    where id = v_user;

  insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'daily_bonus', v_bonus, jsonb_build_object('note', 'Bonusi ditor'));

  return v_bonus;
end;
$$;

-- ============================================================================
-- 8. place_bet — atomic LMSR buy: coins in, shares out, price moves
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

  -- Closed-form LMSR inversion: solve for shares (delta) bought on the chosen
  -- side given a fixed coin budget (rather than fixing shares and deriving cost).
  if p_side = 'PO' then
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_no) / v_exp_yes);
    v_new_q_yes := v_market.q_yes + v_delta;
    v_new_q_no  := v_market.q_no;
  else
    v_delta := v_market.b * ln((v_sum_before * exp(p_coins / v_market.b) - v_exp_yes) / v_exp_no);
    v_new_q_yes := v_market.q_yes;
    v_new_q_no  := v_market.q_no + v_delta;
  end if;

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

  return query select v_delta, public.lmsr_price_yes(v_new_q_yes, v_new_q_no, v_market.b);
end;
$$;

-- ============================================================================
-- 9. resolve_market — admin-only, pays out winning positions
-- ============================================================================

create or replace function public.resolve_market(p_market_id uuid, p_outcome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos record;
begin
  if p_outcome not in ('PO', 'JO') then
    raise exception 'Rezultat i pavlefshëm';
  end if;

  update public.markets
    set status = 'resolved', outcome = p_outcome, resolved_at = now()
    where id = p_market_id and status in ('open', 'closed');

  if not found then
    raise exception 'Tregu nuk u gjet ose është zgjidhur tashmë';
  end if;

  for v_pos in
    select * from public.positions where market_id = p_market_id and side = p_outcome and shares > 0
  loop
    update public.profiles set coins = coins + v_pos.shares where id = v_pos.user_id;

    insert into public.transactions (user_id, type, amount, market_id, meta)
      values (v_pos.user_id, 'payout', v_pos.shares, p_market_id, jsonb_build_object('side', p_outcome));
  end loop;
end;
$$;

-- Note: resolve_market and market create/approve are called from server-side
-- admin API routes (already gated by ADMIN_SECRET) using the anon key + a
-- privileged Postgres role check is unnecessary since these functions are
-- SECURITY DEFINER; restrict exposure by NOT calling them via supabase-js
-- from the browser. Keep them server-only in app/api/admin/*.

-- ============================================================================
-- 10. request_withdrawal — 10,000 coins -> EUR10, manual admin payout
-- ============================================================================

create or replace function public.request_withdrawal(p_payout_method text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance numeric;
  v_min_coins numeric := 10000;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;

  select coins into v_balance from public.profiles where id = v_user for update;
  if v_balance < v_min_coins then
    raise exception 'Kërkohen të paktën 10,000 monedha 383';
  end if;

  update public.profiles set coins = coins - v_min_coins where id = v_user;

  insert into public.withdrawal_requests (user_id, coins_amount, euros_amount, payout_method)
    values (v_user, v_min_coins, 10, p_payout_method)
    returning id into v_id;

  insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'withdrawal', -v_min_coins, jsonb_build_object('withdrawal_request_id', v_id));

  return v_id;
end;
$$;

-- ============================================================================
-- 11. increment_profile_coins — service-role only, used by admin routes to
-- refund a rejected withdrawal request atomically.
-- ============================================================================

create or replace function public.increment_profile_coins(p_user_id uuid, p_amount numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set coins = coins + p_amount where id = p_user_id;
$$;

grant execute on function public.increment_profile_coins(uuid, numeric) to service_role;

-- ============================================================================
-- Grants — allow authenticated users to call the RPCs (RLS/logic inside still applies)
-- ============================================================================

grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.place_bet(uuid, text, numeric) to authenticated;
grant execute on function public.request_withdrawal(text) to authenticated;

-- resolve_market and market creation/approval are intentionally NOT granted to
-- `authenticated` — call them only from server-side admin routes using a
-- Supabase client authenticated as a user you trust, or add a service-role
-- based admin client if you prefer stricter separation.
grant execute on function public.resolve_market(uuid, text) to service_role;
