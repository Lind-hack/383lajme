-- 0002 — Apply the Tregu schema to the EXISTING production database.
--
-- Why this file exists: production already had a `profiles` table from the
-- original auth setup (columns: id, full_name, updated_at), so 0001's
-- `create table if not exists public.profiles` silently skipped it and the
-- rest of the schema was never applied. Result: no coins column, no markets,
-- no signup bonus — logged-in users see no balance chip.
--
-- Run once in the Supabase SQL editor (Project → SQL Editor → paste → Run).
-- Idempotent — safe to run more than once.

-- ============================================================================
-- 1. Patch the existing profiles table with the Tregu columns
-- ============================================================================

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists coins numeric not null default 0,
  add column if not exists last_daily_bonus_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles are viewable publicly (leaderboard-safe fields only via view)" on public.profiles;
create policy "profiles are viewable publicly (leaderboard-safe fields only via view)"
  on public.profiles for select
  using (true);

-- ============================================================================
-- 2. transactions — coin ledger (must exist before the trigger/backfill)
-- ============================================================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal')),
  amount numeric not null,
  market_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

drop policy if exists "users see their own transactions" on public.transactions;
create policy "users see their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 3. Signup trigger — replaces the old profile-creation trigger. Upsert-safe:
--    if another trigger or the app already created the row, it tops it up
--    instead of failing, and keeps full_name working for /profili.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, coins)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    100
  )
  on conflict (id) do update
    set coins = public.profiles.coins + 100,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

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
-- 4. markets
-- ============================================================================

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  question text not null,
  description text,
  category text not null default 'te-tjera',
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'resolved')),
  outcome text check (outcome in ('PO', 'JO')),
  source_article_slugs text[] default '{}',
  ai_generated boolean not null default false,
  approved_by uuid references auth.users(id),
  b numeric not null default 100,
  q_yes numeric not null default 0,
  q_no numeric not null default 0,
  closes_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.markets enable row level security;

drop policy if exists "open/closed/resolved markets are public" on public.markets;
create policy "open/closed/resolved markets are public"
  on public.markets for select
  using (status in ('open', 'closed', 'resolved'));

-- transactions.market_id FK (deferred until markets exists)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'transactions_market_id_fkey' and table_name = 'transactions'
  ) then
    alter table public.transactions
      add constraint transactions_market_id_fkey
      foreign key (market_id) references public.markets(id);
  end if;
end $$;

create or replace function public.lmsr_price_yes(p_q_yes numeric, p_q_no numeric, p_b numeric)
returns numeric
language sql
immutable
as $$
  select exp(p_q_yes / p_b) / (exp(p_q_yes / p_b) + exp(p_q_no / p_b));
$$;

-- ============================================================================
-- 5. market_snapshots
-- ============================================================================

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  ai_prob numeric,
  market_prob numeric not null,
  volume numeric not null default 0,
  evidence jsonb,
  created_at timestamptz not null default now()
);

alter table public.market_snapshots enable row level security;

drop policy if exists "snapshots are public" on public.market_snapshots;
create policy "snapshots are public"
  on public.market_snapshots for select
  using (true);

-- ============================================================================
-- 6. positions
-- ============================================================================

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  side text not null check (side in ('PO', 'JO')),
  shares numeric not null default 0,
  coins_staked numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, market_id, side)
);

alter table public.positions enable row level security;

drop policy if exists "users see their own positions" on public.positions;
create policy "users see their own positions"
  on public.positions for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 7. withdrawal_requests
-- ============================================================================

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  coins_amount numeric not null,
  euros_amount numeric not null,
  payout_method text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  admin_notes text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.withdrawal_requests enable row level security;

drop policy if exists "users see their own withdrawal requests" on public.withdrawal_requests;
create policy "users see their own withdrawal requests"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

-- ============================================================================
-- 8. RPCs — daily bonus, betting, resolution, withdrawal (same as 0001)
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

create or replace function public.increment_profile_coins(p_user_id uuid, p_amount numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set coins = coins + p_amount where id = p_user_id;
$$;

grant execute on function public.increment_profile_coins(uuid, numeric) to service_role;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.place_bet(uuid, text, numeric) to authenticated;
grant execute on function public.request_withdrawal(text) to authenticated;
grant execute on function public.resolve_market(uuid, text) to service_role;

-- ============================================================================
-- 9. BACKFILL — every existing account gets its 100-coin signup bonus once.
--    Guarded by the absence of a signup_bonus transaction, so re-running
--    this script never double-grants.
-- ============================================================================

-- 9a. Profiles for any auth user that somehow has none (coins 0 here;
--     the +100 comes in 9b so nobody is counted twice).
insert into public.profiles (id, full_name, display_name, coins)
select
  u.id,
  u.raw_user_meta_data->>'full_name',
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  0
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 9b. +100 coins for everyone who never received the signup bonus.
update public.profiles p
set coins = p.coins + 100,
    display_name = coalesce(p.display_name, p.full_name)
where not exists (
  select 1 from public.transactions t
  where t.user_id = p.id and t.type = 'signup_bonus'
);

-- 9c. Ledger entries for the bonuses just granted (also the re-run guard).
insert into public.transactions (user_id, type, amount, meta)
select p.id, 'signup_bonus', 100, jsonb_build_object('note', 'Bonusi i regjistrimit')
from public.profiles p
where not exists (
  select 1 from public.transactions t
  where t.user_id = p.id and t.type = 'signup_bonus'
);
