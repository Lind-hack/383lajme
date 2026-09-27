-- 383 Tregu — leaderboard on closed trades, Kosovo-time periods, and prizes
--
-- Run once, in one transaction, like every other migration here.
--
-- 1. Scoring. 0079 summed every bet/sell/payout by the moment it happened, so a
--    stake counted as a loss the second it was placed and a Sunday-night bet
--    that won on Monday was split across two weeks (-stake, then +payout). A
--    trade now counts only once it is closed — sold out completely, or the
--    market resolved and paid — and its whole result lands in the period it
--    closed in.
-- 2. Periods run on Kosovo time (Europe/Belgrade): the week closes Sunday
--    24:00, the month on its last day at 24:00. 0079's route used UTC, which
--    ended the week at 01:00/02:00 local.
-- 3. Prizes. When a period ends the top 3 are frozen into
--    tregu_leaderboard_rewards as 'pending'. Nothing reaches a user until an
--    admin approves the row; the user then opens it as a gift and collects it,
--    which credits coins and writes a 'leaderboard_reward' transaction.
-- 4. Categories. 'politike' splits into 'kosove' and 'shqiperi', matching the
--    news side's Kosovë / Shqipëri sections.

-- ============================================================================
-- Period bounds
-- ============================================================================

-- p_offset 0 is the running period, -1 the one that just ended.
create or replace function public.tregu_period_bounds(p_kind text, p_offset int default 0)
returns table (period_start timestamptz, period_end timestamptz)
language sql
stable
set search_path = public
as $$
  with local_now as (
    select (now() at time zone 'Europe/Belgrade') as ts
  ),
  anchor as (
    select case
      when p_kind = 'monthly' then date_trunc('month', ts) + make_interval(months => p_offset)
      else date_trunc('week', ts) + make_interval(weeks => p_offset)
    end as local_start
    from local_now
  )
  select
    local_start at time zone 'Europe/Belgrade',
    (local_start + case when p_kind = 'monthly' then interval '1 month' else interval '1 week' end)
      at time zone 'Europe/Belgrade'
  from anchor;
$$;

grant execute on function public.tregu_period_bounds(text, int) to anon, authenticated;

-- ============================================================================
-- Scores (internal: returns user ids, so it is never granted to clients)
-- ============================================================================

create or replace function public.tregu_leaderboard_scores(p_from timestamptz, p_to timestamptz)
returns table (uid uuid, net numeric, reached_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with per_market as (
    select t.user_id as u, t.market_id as mid, sum(t.amount) as pnl, max(t.created_at) as last_at
    from public.transactions t
    where t.type in ('bet', 'sell', 'payout')
      and t.market_id is not null
    group by t.user_id, t.market_id
  ),
  held as (
    select
      pm.*,
      m.status,
      coalesce(m.resolved_at, m.updated_at) as settled_at,
      exists (
        select 1 from public.positions p
        where p.user_id = pm.u and p.market_id = pm.mid and p.shares > 0.000001
      ) as holding
    from per_market pm
    join public.markets m on m.id = pm.mid
  ),
  closed as (
    -- Sold out: closed at the last sale, even if the market resolves later.
    -- Resolution never touches positions, so without this a position sold in
    -- one week would jump to the week its market settled and could be counted
    -- for a second prize. Still holding: closed when the market resolved.
    select
      h.u,
      h.pnl,
      case when h.holding then greatest(h.last_at, h.settled_at) else h.last_at end as closed_at
    from held h
    where not h.holding or h.status = 'resolved'
  )
  select c.u, sum(c.pnl), max(c.closed_at)
  from closed c
  where c.closed_at >= p_from and c.closed_at < p_to
  group by c.u;
$$;

revoke all on function public.tregu_leaderboard_scores(timestamptz, timestamptz) from public, anon, authenticated;

-- ============================================================================
-- Public board: names, ranks and profit only
-- ============================================================================

create or replace function public.tregu_leaderboard_board(p_kind text, p_limit int default 5)
returns table (rank bigint, display_name text, profit numeric, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select * from public.tregu_period_bounds(p_kind, 0)
  ),
  ranked as (
    select
      -- Equal profit: whoever got there first ranks higher.
      row_number() over (order by s.net desc, s.reached_at asc, s.uid) as place,
      s.uid,
      s.net
    from bounds b
    cross join lateral public.tregu_leaderboard_scores(b.period_start, b.period_end) s
    where s.net > 0
  )
  select
    r.place,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    round(r.net, 0),
    (r.uid = auth.uid())
  from ranked r
  join public.profiles p on p.id = r.uid
  where r.place <= greatest(1, p_limit) or r.uid = auth.uid()
  order by r.place;
$$;

grant execute on function public.tregu_leaderboard_board(text, int) to anon, authenticated;

-- ============================================================================
-- Rewards
-- ============================================================================

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal', 'sell', 'leaderboard_reward'));

-- One row per period once it has been frozen, winners or not, so a period is
-- judged exactly once: a trade that settles after the lock cannot reshuffle a
-- podium that was already announced.
create table if not exists public.tregu_leaderboard_periods (
  period_kind text not null check (period_kind in ('weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  locked_at timestamptz not null default now(),
  primary key (period_kind, period_start)
);

alter table public.tregu_leaderboard_periods enable row level security;

create table if not exists public.tregu_leaderboard_rewards (
  id uuid primary key default gen_random_uuid(),
  period_kind text not null check (period_kind in ('weekly', 'monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  place int not null check (place between 1 and 3),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  profit numeric not null,
  prize numeric not null check (prize > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'claimed', 'rejected')),
  notified_at timestamptz,
  approved_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (period_kind, period_start, place)
);

alter table public.tregu_leaderboard_rewards enable row level security;

-- A winner sees their own gift once it is approved, never while it is pending.
drop policy if exists "users see their own approved rewards" on public.tregu_leaderboard_rewards;
create policy "users see their own approved rewards"
  on public.tregu_leaderboard_rewards for select
  using (auth.uid() = user_id and status in ('approved', 'claimed'));

create index if not exists tregu_leaderboard_rewards_user_idx
  on public.tregu_leaderboard_rewards (user_id, status);

-- Freezes the period that just ended. Returns the rewards it created; an
-- already-locked period returns nothing, so the 5-minute cron can call this
-- every run and only the first call after a boundary does anything.
create or replace function public.tregu_lock_leaderboard_period(p_kind text, p_prizes numeric[])
returns setof public.tregu_leaderboard_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_kind not in ('weekly', 'monthly') then
    raise exception 'unknown period kind %', p_kind;
  end if;

  select period_start, period_end into v_start, v_end from public.tregu_period_bounds(p_kind, -1);

  insert into public.tregu_leaderboard_periods (period_kind, period_start, period_end)
  values (p_kind, v_start, v_end)
  on conflict do nothing;
  if not found then
    return;
  end if;

  -- Prizes start with the week ending Sunday 27 September 2026 (24:00 Kosovo).
  -- Earlier periods are recorded as locked, without paying anyone back-dated.
  if v_end < timestamptz '2026-09-28 00:00:00 Europe/Belgrade' then
    return;
  end if;

  return query
  insert into public.tregu_leaderboard_rewards
    (period_kind, period_start, period_end, place, user_id, display_name, profit, prize)
  select p_kind, v_start, v_end, r.place, r.uid,
         coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
         round(r.net, 0), p_prizes[r.place]
  from (
    select row_number() over (order by s.net desc, s.reached_at asc, s.uid)::int as place, s.uid, s.net
    from public.tregu_leaderboard_scores(v_start, v_end) s
    where s.net > 0
  ) r
  join public.profiles p on p.id = r.uid
  where r.place <= least(3, coalesce(array_length(p_prizes, 1), 0))
    and p_prizes[r.place] > 0
  returning *;
end;
$$;

revoke all on function public.tregu_lock_leaderboard_period(text, numeric[]) from public, anon, authenticated;
grant execute on function public.tregu_lock_leaderboard_period(text, numeric[]) to service_role;

-- The one-click collect. Only an approved, unclaimed reward of the caller's.
create or replace function public.tregu_claim_leaderboard_reward(p_reward_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.tregu_leaderboard_rewards%rowtype;
  v_balance numeric;
begin
  if v_user is null then
    raise exception 'Duhet të hysh në llogari.';
  end if;

  update public.tregu_leaderboard_rewards
  set status = 'claimed', claimed_at = now()
  where id = p_reward_id and user_id = v_user and status = 'approved'
  returning * into v_reward;

  if not found then
    raise exception 'Shpërblimi nuk është i disponueshëm.';
  end if;

  update public.profiles set coins = coins + v_reward.prize where id = v_user
  returning coins into v_balance;

  insert into public.transactions (user_id, type, amount, meta)
  values (v_user, 'leaderboard_reward', v_reward.prize, jsonb_build_object(
    'reward_id', v_reward.id,
    'period_kind', v_reward.period_kind,
    'period_start', v_reward.period_start,
    'period_end', v_reward.period_end,
    'place', v_reward.place,
    'note', format('Shpërblim nga renditja (%s, vendi #%s)',
      case when v_reward.period_kind = 'monthly' then 'Muaji' else 'Java' end, v_reward.place)
  ));

  return v_balance;
end;
$$;

revoke all on function public.tregu_claim_leaderboard_reward(uuid) from public, anon;
grant execute on function public.tregu_claim_leaderboard_reward(uuid) to authenticated;

-- ============================================================================
-- Categories: politike -> kosove | shqiperi | bote
-- ============================================================================

-- 'politike' held world politics too (Trump, Iran, Hungary): those go to Botë
-- rather than being filed under Kosovë by default.
update public.markets
set category = case
    when question ~* '(shqip[eë]ri|tiran|rama\M|berish|albania)'
      or coalesce(description, '') ~* '(shqip[eë]ri|tiran|albania)'
      then 'shqiperi'
    when question ~* '(kosov|kurti|kfor|zve[cç]an|ib[eë]r|ibrit|kuvend|abdixhik|kadrijaj|vu[cç]i[cç]|mitrovic|prishtin|serbi)'
      then 'kosove'
    else 'bote'
  end,
  updated_at = now()
where category = 'politike';
