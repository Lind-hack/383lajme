-- 383 Për ty: a few Tregu coins for finishing the day's paper.
--
-- Run once, in one transaction, like every other migration here.
--
-- A signed-in reader who reads their whole edition can collect a small reward
-- once per Kosovo day: 5 coins, one more for every day in a row they collected
-- (up to 10). What was read stays on the device (lib/perty-visits), so the
-- database cannot check it: the once-a-day limit and the small amount are the
-- guard. Coins are play money for Tregu.
--
-- 1. perty_daily_rewards: one row per reader per Kosovo day. RLS on, no
--    policies: only the functions below touch it.
-- 2. 'perty_reward' joins the transaction types. The constraint is rebuilt from
--    the live one, so types added on production outside these files survive.
-- 3. perty_reward_status() and perty_claim_daily_reward(), for signed-in readers.

create table if not exists public.perty_daily_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  amount int not null check (amount between 1 and 50),
  streak int not null check (streak >= 1),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.perty_daily_rewards enable row level security;

do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conname = 'transactions_type_check' and conrelid = 'public.transactions'::regclass;

  if v_def is null then
    raise exception 'transactions_type_check not found';
  end if;
  if position('''perty_reward''' in v_def) > 0 then
    return;
  end if;
  if position('ARRAY[' in v_def) = 0 then
    raise exception 'unexpected transactions_type_check shape: %', v_def;
  end if;

  execute 'alter table public.transactions drop constraint transactions_type_check';
  execute 'alter table public.transactions add constraint transactions_type_check '
    || replace(v_def, 'ARRAY[', 'ARRAY[''perty_reward''::text, ');
end;
$$;

-- What the next claim would be worth, from the run of days already collected.
create or replace function public.perty_reward_next(p_user uuid, p_today date)
returns table (streak int, amount int)
language sql
stable
security definer
set search_path = public
as $$
  select s.streak, least(10, 4 + s.streak) as amount
  from (
    select case
      when exists (select 1 from public.perty_daily_rewards r where r.user_id = p_user and r.day = p_today - 1)
        then coalesce((select r.streak from public.perty_daily_rewards r where r.user_id = p_user and r.day = p_today - 1), 0) + 1
      else 1
    end as streak
  ) s;
$$;

create or replace function public.perty_reward_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.tregu_kosovo_day();
  v_claimed public.perty_daily_rewards%rowtype;
  v_next record;
begin
  if v_user is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select * into v_claimed from public.perty_daily_rewards where user_id = v_user and day = v_today;
  if found then
    return jsonb_build_object('signed_in', true, 'claimed', true, 'amount', v_claimed.amount, 'streak', v_claimed.streak);
  end if;

  select * into v_next from public.perty_reward_next(v_user, v_today);
  return jsonb_build_object('signed_in', true, 'claimed', false, 'amount', v_next.amount, 'streak', v_next.streak);
end;
$$;

create or replace function public.perty_claim_daily_reward()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.tregu_kosovo_day();
  v_next record;
  v_balance numeric;
begin
  if v_user is null then
    raise exception 'Duhet të hysh në llogari.';
  end if;

  select * into v_next from public.perty_reward_next(v_user, v_today);

  insert into public.perty_daily_rewards (user_id, day, amount, streak)
  values (v_user, v_today, v_next.amount, v_next.streak)
  on conflict (user_id, day) do nothing;
  if not found then
    raise exception 'Shpërblimin e sotëm e ke marrë.';
  end if;

  update public.profiles set coins = coins + v_next.amount where id = v_user
  returning coins into v_balance;
  if not found then
    raise exception 'Profili nuk u gjet.';
  end if;

  insert into public.transactions (user_id, type, amount, meta)
  values (v_user, 'perty_reward', v_next.amount, jsonb_build_object(
    'day', v_today,
    'streak', v_next.streak,
    'note', 'Shpërblim për gazetën e lexuar'
  ));

  return jsonb_build_object('amount', v_next.amount, 'streak', v_next.streak, 'balance', v_balance);
end;
$$;

revoke all on function public.perty_reward_next(uuid, date) from public, anon, authenticated;
revoke all on function public.perty_reward_status() from public, anon;
revoke all on function public.perty_claim_daily_reward() from public, anon;
grant execute on function public.perty_reward_status() to authenticated;
grant execute on function public.perty_claim_daily_reward() to authenticated;
