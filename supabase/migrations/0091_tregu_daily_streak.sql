-- 383 Tregu — the daily bonus becomes earned, streaked and occasionally a jackpot
--
-- Run once, in one transaction, like every other migration here.
--
-- 1. Locked until the reader trades: today's bonus opens only after at least
--    one buy on a Kosovo calendar day (market_trades, action = 'buy').
-- 2. One claim per Kosovo day (was: 24 rolling hours, which drifted later
--    every day for anyone who claimed in the evening).
-- 3. A streak: consecutive Kosovo days claimed. Miss a day and it restarts at 1.
-- 4. The amount is rolled here, never by the client: 10..25 coins, higher is
--    rarer, and 25 is the jackpot. The jackpot chance grows with the streak,
--    2% on day 1 to 6% from day 7; the streak also lifts 18..24 slightly.
-- 5. The old claim_daily_bonus() is closed to clients, so the trade lock cannot
--    be skipped by calling it directly.

alter table public.profiles
  add column if not exists daily_streak int not null default 0,
  add column if not exists last_daily_bonus_on date;

create index if not exists market_trades_user_time_idx
  on public.market_trades (user_id, created_at);

-- Kosovo's calendar day for an instant. The streak and the lock both use it.
create or replace function public.tregu_kosovo_day(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select (p_at at time zone 'Europe/Belgrade')::date;
$$;

-- What the bonus button should show. Never changes anything.
create or replace function public.tregu_daily_bonus_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.tregu_kosovo_day();
  v_last date;
  v_streak int;
  v_traded boolean;
begin
  if v_user is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select last_daily_bonus_on, daily_streak into v_last, v_streak
  from public.profiles where id = v_user;

  select exists (
    select 1 from public.market_trades
    where user_id = v_user
      and action = 'buy'
      and created_at >= (v_today::timestamp at time zone 'Europe/Belgrade')
  ) into v_traded;

  return jsonb_build_object(
    'signed_in', true,
    'claimed_today', v_last = v_today,
    'traded_today', v_traded,
    -- The streak a claim today would continue; a missed day shows 0.
    'streak', case
      when v_last = v_today or v_last = v_today - 1 then coalesce(v_streak, 0)
      else 0
    end,
    'next_streak', case
      when v_last = v_today then coalesce(v_streak, 0)
      when v_last = v_today - 1 then coalesce(v_streak, 0) + 1
      else 1
    end
  );
end;
$$;

-- The roll. Pure so it can be read and tested on its own: p_roll is a uniform
-- draw in [0, 1), p_streak the streak this claim lands on.
create or replace function public.tregu_daily_bonus_amount(p_streak int, p_roll double precision)
returns int
language plpgsql
immutable
as $$
declare
  v_step int := least(greatest(coalesce(p_streak, 1), 1), 7) - 1;   -- 0..6
  v_jackpot double precision := 0.02 + v_step * (0.04 / 6);          -- 2% .. 6%
  v_lift double precision := 1 + v_step * 0.06;                      -- 18..24 up to +36%
  -- Weights for 10..24, falling as the amount rises.
  v_weights double precision[] := array[18, 16, 14, 12, 10, 8, 5.5, 4.5, 3.5, 2.5, 1.8, 1.3, 1.0, 0.7, 0.5];
  v_total double precision := 0;
  v_pick double precision;
  v_i int;
  v_w double precision;
begin
  if p_roll < v_jackpot then
    return 25;
  end if;
  for v_i in 1..15 loop
    v_total := v_total + v_weights[v_i] * case when v_i >= 9 then v_lift else 1 end;
  end loop;
  -- Rescale the rest of the draw onto the non-jackpot weights.
  v_pick := (p_roll - v_jackpot) / (1 - v_jackpot) * v_total;
  for v_i in 1..15 loop
    v_w := v_weights[v_i] * case when v_i >= 9 then v_lift else 1 end;
    if v_pick < v_w then
      return 9 + v_i;
    end if;
    v_pick := v_pick - v_w;
  end loop;
  return 24;
end;
$$;

create or replace function public.tregu_claim_daily_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today date := public.tregu_kosovo_day();
  v_last date;
  v_streak int;
  v_amount int;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur';
  end if;

  select last_daily_bonus_on, daily_streak into v_last, v_streak
  from public.profiles where id = v_user
  for update;

  if v_last = v_today then
    raise exception 'Bonusin e sotëm e more. Kthehu nesër.';
  end if;

  if not exists (
    select 1 from public.market_trades
    where user_id = v_user
      and action = 'buy'
      and created_at >= (v_today::timestamp at time zone 'Europe/Belgrade')
  ) then
    raise exception 'Bëj një tregtim sot për të hapur bonusin ditor.';
  end if;

  v_streak := case when v_last = v_today - 1 then coalesce(v_streak, 0) + 1 else 1 end;
  v_amount := public.tregu_daily_bonus_amount(v_streak, random());

  update public.profiles
    set coins = coins + v_amount,
        last_daily_bonus_at = now(),
        last_daily_bonus_on = v_today,
        daily_streak = v_streak
    where id = v_user;

  insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'daily_bonus', v_amount, jsonb_build_object(
      'note', case when v_amount = 25 then 'Bonusi ditor · Xhekpot' else 'Bonusi ditor' end,
      'streak', v_streak,
      'jackpot', v_amount = 25
    ));

  return jsonb_build_object('amount', v_amount, 'streak', v_streak, 'jackpot', v_amount = 25);
end;
$$;

revoke all on function public.tregu_daily_bonus_status() from public;
revoke all on function public.tregu_claim_daily_bonus() from public;
grant execute on function public.tregu_daily_bonus_status() to authenticated;
grant execute on function public.tregu_claim_daily_bonus() to authenticated;

-- The old unlocked claim stays for the record but no client can call it.
revoke execute on function public.claim_daily_bonus() from authenticated, anon, public;

-- Carry today's state across: anyone who already claimed today under the old
-- rule keeps that claim, and starts a streak of 1.
update public.profiles
  set last_daily_bonus_on = public.tregu_kosovo_day(last_daily_bonus_at),
      daily_streak = 1
  where last_daily_bonus_at is not null
    and last_daily_bonus_on is null
    and public.tregu_kosovo_day(last_daily_bonus_at) = public.tregu_kosovo_day();
