-- 383 Tregu — leagues: public (admin-run, 383 pays) and private (friends, by code)
--
-- Run once, in one transaction, like every other migration here.
--
-- Ranking is the leaderboard's own rule (0083): profit from trades that
-- close inside the league window. Each member's window starts when they
-- joined, so nobody can join late and bring a win they already had.
--
-- Money:
--   * Public leagues pay fixed prizes set by the admin, to members who are up
--     on the window. Those rows are created 'pending' and go through the
--     same Konfirmo email + admin approval as the leaderboard.
--   * Private leagues pay only from their own pot: the entry fees members
--     paid, split 50/30/20. No coins are created, so a league of alt
--     accounts has nothing to farm, and the rows are created 'approved'.
-- Either way the winner opens the prize as a gift (tregu_leaderboard_rewards).

-- ============================================================================
-- Closed trades, shared by the leaderboard and leagues
-- ============================================================================

-- One row per (trader, market) whose position is closed, with its whole P/L
-- and the moment it closed. Same rule as 0083's scores, factored out so both
-- boards read one definition.
create or replace function public.tregu_closed_trades()
returns table (uid uuid, pnl numeric, closed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with per_market as (
    select t.user_id as u, t.market_id as mid, sum(t.amount) as net, max(t.created_at) as last_at
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
  )
  select
    h.u,
    h.net,
    case when h.holding then greatest(h.last_at, h.settled_at) else h.last_at end
  from held h
  where not h.holding or h.status = 'resolved';
$$;

revoke all on function public.tregu_closed_trades() from public, anon, authenticated;

create or replace function public.tregu_leaderboard_scores(p_from timestamptz, p_to timestamptz)
returns table (uid uuid, net numeric, reached_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.uid, sum(c.pnl), max(c.closed_at)
  from public.tregu_closed_trades() c
  where c.closed_at >= p_from and c.closed_at < p_to
  group by c.uid;
$$;

revoke all on function public.tregu_leaderboard_scores(timestamptz, timestamptz) from public, anon, authenticated;

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.tregu_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 40),
  kind text not null check (kind in ('public', 'private')),
  -- Private only: 6 characters from an alphabet without 0/O/1/I/L.
  code text unique check (code is null or code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  creator_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  entry_fee numeric not null default 0 check (entry_fee >= 0 and entry_fee <= 1000),
  -- Public only: fixed prizes for places 1..3, paid by 383.
  prizes numeric[],
  max_members int not null default 50 check (max_members between 2 and 500),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((kind = 'private') = (code is not null)),
  check (kind = 'public' or prizes is null)
);

alter table public.tregu_leagues enable row level security;
-- No direct client access: every read and write goes through the functions
-- below, which decide what a caller may see (a private league's code only to
-- its members).

create index if not exists tregu_leagues_due_idx on public.tregu_leagues (ends_at) where settled_at is null;

create table if not exists public.tregu_league_members (
  league_id uuid not null references public.tregu_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  fee_paid numeric not null default 0,
  primary key (league_id, user_id)
);

alter table public.tregu_league_members enable row level security;
create index if not exists tregu_league_members_user_idx on public.tregu_league_members (user_id);

-- ============================================================================
-- Rewards: league prizes ride the leaderboard's gift + claim flow
-- ============================================================================

alter table public.tregu_leaderboard_rewards
  add column if not exists league_id uuid references public.tregu_leagues(id) on delete cascade,
  add column if not exists league_name text;

alter table public.tregu_leaderboard_rewards drop constraint if exists tregu_leaderboard_rewards_period_kind_check;
alter table public.tregu_leaderboard_rewards add constraint tregu_leaderboard_rewards_period_kind_check
  check (period_kind in ('weekly', 'monthly', 'league'));

-- One prize per place: per period for the leaderboard, per league for leagues.
alter table public.tregu_leaderboard_rewards drop constraint if exists tregu_leaderboard_rewards_period_kind_period_start_place_key;
create unique index if not exists tregu_leaderboard_rewards_period_place_key
  on public.tregu_leaderboard_rewards (period_kind, period_start, place) where league_id is null;
create unique index if not exists tregu_leaderboard_rewards_league_place_key
  on public.tregu_leaderboard_rewards (league_id, place) where league_id is not null;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal', 'sell',
                  'leaderboard_reward', 'league_fee', 'league_reward'));

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
  values (
    v_user,
    case when v_reward.league_id is null then 'leaderboard_reward' else 'league_reward' end,
    v_reward.prize,
    jsonb_build_object(
      'reward_id', v_reward.id,
      'period_kind', v_reward.period_kind,
      'period_start', v_reward.period_start,
      'period_end', v_reward.period_end,
      'place', v_reward.place,
      'league_id', v_reward.league_id,
      'note', case
        when v_reward.league_id is not null
          then format('Shpërblim nga liga "%s" (vendi #%s)', v_reward.league_name, v_reward.place)
        else format('Shpërblim nga renditja (%s, vendi #%s)',
          case when v_reward.period_kind = 'monthly' then 'Muaji' else 'Java' end, v_reward.place)
      end
    )
  );

  return v_balance;
end;
$$;

revoke all on function public.tregu_claim_leaderboard_reward(uuid) from public, anon;
grant execute on function public.tregu_claim_leaderboard_reward(uuid) to authenticated;

-- ============================================================================
-- Scores inside a league
-- ============================================================================

-- Every member, including those with nothing closed yet (net 0).
create or replace function public.tregu_league_scores(p_league_id uuid)
returns table (uid uuid, net numeric, reached_at timestamptz, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select * from public.tregu_leagues where id = p_league_id
  ),
  closed as (
    select c.* from public.tregu_closed_trades() c
    where c.uid in (select user_id from public.tregu_league_members where league_id = p_league_id)
  )
  select
    m.user_id,
    coalesce(sum(c.pnl) filter (where c.closed_at >= greatest(lg.starts_at, m.joined_at) and c.closed_at < lg.ends_at), 0),
    max(c.closed_at) filter (where c.closed_at >= greatest(lg.starts_at, m.joined_at) and c.closed_at < lg.ends_at),
    m.joined_at
  from public.tregu_league_members m
  cross join lg
  left join closed c on c.uid = m.user_id
  where m.league_id = p_league_id
  group by m.user_id, m.joined_at;
$$;

revoke all on function public.tregu_league_scores(uuid) from public, anon, authenticated;

-- ============================================================================
-- Client functions
-- ============================================================================

-- Public leagues (running, upcoming, or ended in the last 14 days) plus every
-- league the caller belongs to, with the caller's rank in each.
create or replace function public.tregu_leagues_overview()
returns table (
  id uuid, name text, kind text, code text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, is_creator boolean, my_rank int, my_profit numeric, settled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select l.*
    from public.tregu_leagues l
    where (l.kind = 'public' and l.ends_at > now() - interval '14 days')
       or exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid())
  ),
  counts as (
    select m.league_id, count(*)::int as n, coalesce(sum(m.fee_paid), 0) as pot
    from public.tregu_league_members m
    where m.league_id in (select v.id from visible v)
    group by m.league_id
  ),
  mine as (
    select v.id as league_id, r.place, r.net
    from visible v
    cross join lateral (
      select s.uid, s.net,
        row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
      from public.tregu_league_scores(v.id) s
    ) r
    where r.uid = auth.uid()
  )
  select
    v.id, v.name, v.kind,
    case when mi.league_id is not null then v.code end,
    v.starts_at, v.ends_at, v.entry_fee, v.prizes,
    coalesce(c.pot, 0), coalesce(c.n, 0), v.max_members,
    mi.league_id is not null,
    v.creator_id = auth.uid(),
    mi.place, round(mi.net, 0),
    v.settled_at is not null
  from visible v
  left join counts c on c.league_id = v.id
  left join mine mi on mi.league_id = v.id
  order by (v.ends_at < now()), v.ends_at asc;
$$;

grant execute on function public.tregu_leagues_overview() to anon, authenticated;

-- What a code (or a public league id) opens: enough to decide to join.
create or replace function public.tregu_league_preview(p_code text default null, p_league_id uuid default null)
returns table (
  id uuid, name text, kind text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, settled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.name, l.kind, l.starts_at, l.ends_at, l.entry_fee, l.prizes,
    coalesce((select sum(m.fee_paid) from public.tregu_league_members m where m.league_id = l.id), 0),
    (select count(*)::int from public.tregu_league_members m where m.league_id = l.id),
    l.max_members,
    exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()),
    l.settled_at is not null
  from public.tregu_leagues l
  where (p_code is not null and l.code = upper(trim(p_code)))
     or (p_league_id is not null and l.id = p_league_id and (
          l.kind = 'public'
          or exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid())
        ));
$$;

grant execute on function public.tregu_league_preview(text, uuid) to anon, authenticated;

-- Standings: public leagues to anyone, private leagues to members only.
create or replace function public.tregu_league_standings(p_league_id uuid)
returns table (rank int, display_name text, profit numeric, is_me boolean, is_creator boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.place,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    round(r.net, 0),
    coalesce(r.uid = auth.uid(), false),
    coalesce(r.uid = l.creator_id, false)
  from public.tregu_leagues l
  cross join lateral (
    select s.uid, s.net,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
    from public.tregu_league_scores(l.id) s
  ) r
  join public.profiles p on p.id = r.uid
  where l.id = p_league_id
    and (l.kind = 'public' or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  order by r.place;
$$;

grant execute on function public.tregu_league_standings(uuid) to anon, authenticated;

-- Create a private league. The creator joins it (and pays its fee) at once.
create or replace function public.tregu_league_create(p_name text, p_days int, p_entry_fee numeric default 0)
returns table (id uuid, code text, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_balance numeric;
  v_fee numeric := round(coalesce(p_entry_fee, 0));
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'Emri i ligës duhet të ketë 3 deri në 40 shkronja.';
  end if;
  if p_days not in (1, 3, 7, 14, 30) then raise exception 'Kohëzgjatja nuk vlen.'; end if;
  if v_fee < 0 or v_fee > 1000 then raise exception 'Tarifa duhet të jetë 0 deri në 1 000 monedha.'; end if;
  if (select count(*) from public.tregu_leagues l
      where l.creator_id = v_user and l.kind = 'private' and l.ends_at > now()) >= 3 then
    raise exception 'Mund të kesh deri në 3 liga aktive njëherësh.';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.tregu_leagues l where l.code = v_code);
  end loop;

  insert into public.tregu_leagues (name, kind, code, creator_id, starts_at, ends_at, entry_fee)
  values (trim(p_name), 'private', v_code, v_user, now(), now() + make_interval(days => p_days), v_fee)
  returning tregu_leagues.id into v_id;

  select j.balance into v_balance from public.tregu_league_join(v_id, null) j;
  return query select v_id, v_code, v_balance;
end;
$$;

-- Join by id (public) or by code (private). Pays the entry fee, if any.
create or replace function public.tregu_league_join(p_league_id uuid default null, p_code text default null)
returns table (league_id uuid, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_balance numeric;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;

  if p_code is not null then
    select * into v_league from public.tregu_leagues l where l.code = upper(trim(p_code)) for update;
  else
    select * into v_league from public.tregu_leagues l where l.id = p_league_id for update;
    -- A private league is only reachable by its code (its creator joins by id
    -- from tregu_league_create, where the caller is the creator).
    if found and v_league.kind = 'private' and v_league.creator_id is distinct from v_user then
      raise exception 'Kjo ligë është private: hyr me kodin e saj.';
    end if;
  end if;
  if not found then raise exception 'Liga nuk u gjet. Kontrollo kodin.'; end if;

  if v_league.ends_at <= now() or v_league.settled_at is not null then
    raise exception 'Kjo ligë ka përfunduar.';
  end if;
  if exists (select 1 from public.tregu_league_members m where m.league_id = v_league.id and m.user_id = v_user) then
    raise exception 'Je tashmë anëtar i kësaj lige.';
  end if;
  if (select count(*) from public.tregu_league_members m where m.league_id = v_league.id) >= v_league.max_members then
    raise exception 'Liga është plot.';
  end if;

  if v_league.entry_fee > 0 then
    update public.profiles set coins = coins - v_league.entry_fee
    where id = v_user and coins >= v_league.entry_fee
    returning coins into v_balance;
    if not found then raise exception 'Nuk ke mjaft monedha për tarifën e hyrjes.'; end if;

    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'league_fee', -v_league.entry_fee, jsonb_build_object(
      'league_id', v_league.id,
      'note', format('Hyrje në ligën "%s"', v_league.name)
    ));
  else
    select coins into v_balance from public.profiles where id = v_user;
  end if;

  insert into public.tregu_league_members (league_id, user_id, fee_paid)
  values (v_league.id, v_user, v_league.entry_fee);

  return query select v_league.id, v_balance;
end;
$$;

revoke all on function public.tregu_league_create(text, int, numeric) from public, anon;
revoke all on function public.tregu_league_join(uuid, text) from public, anon;
grant execute on function public.tregu_league_create(text, int, numeric) to authenticated;
grant execute on function public.tregu_league_join(uuid, text) to authenticated;

-- ============================================================================
-- Settlement (service role, from the 5-minute cron)
-- ============================================================================

-- Settles every league whose window has closed. Returns the rewards it made.
create or replace function public.tregu_settle_due_leagues()
returns setof public.tregu_leaderboard_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.tregu_leagues%rowtype;
  v_pot numeric;
  v_winners int;
  v_shares numeric[];
  v_share_sum numeric;
  v_amounts numeric[];
  v_i int;
begin
  for v_league in
    select * from public.tregu_leagues
    where settled_at is null and ends_at <= now()
    order by ends_at
    for update skip locked
  loop
    update public.tregu_leagues set settled_at = now() where id = v_league.id;

    if v_league.kind = 'public' then
      -- 383 pays fixed prizes to members who are up; the admin confirms.
      return query
      insert into public.tregu_leaderboard_rewards
        (period_kind, period_start, period_end, place, user_id, display_name, profit, prize,
         status, league_id, league_name)
      select 'league', v_league.starts_at, v_league.ends_at, r.place, r.uid,
             coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
             round(r.net, 0), v_league.prizes[r.place], 'pending', v_league.id, v_league.name
      from (
        select s.uid, s.net,
          row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
        from public.tregu_league_scores(v_league.id) s
        where s.net > 0
      ) r
      join public.profiles p on p.id = r.uid
      where r.place <= least(3, coalesce(array_length(v_league.prizes, 1), 0))
        and v_league.prizes[r.place] > 0
      returning *;
    else
      -- The pot is the members' own fees: all of it goes back, 50/30/20
      -- (renormalised when fewer than three members), rounded down, with the
      -- rounding remainder to first. Everyone ranks, up or down.
      select coalesce(sum(fee_paid), 0), count(*)::int into v_pot, v_winners
      from public.tregu_league_members where league_id = v_league.id;
      v_winners := least(3, v_winners);
      if v_pot <= 0 or v_winners = 0 then
        continue;
      end if;

      v_shares := (array[50, 30, 20]::numeric[])[1:v_winners];
      select sum(x) into v_share_sum from unnest(v_shares) x;
      v_amounts := array[]::numeric[];
      for v_i in 1..v_winners loop
        v_amounts := v_amounts || floor(v_pot * v_shares[v_i] / v_share_sum);
      end loop;
      v_amounts[1] := v_amounts[1] + (v_pot - (select sum(x) from unnest(v_amounts) x));

      return query
      insert into public.tregu_leaderboard_rewards
        (period_kind, period_start, period_end, place, user_id, display_name, profit, prize,
         status, approved_at, league_id, league_name)
      select 'league', v_league.starts_at, v_league.ends_at, r.place, r.uid,
             coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
             round(r.net, 0), v_amounts[r.place], 'approved', now(), v_league.id, v_league.name
      from (
        select s.uid, s.net,
          row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
        from public.tregu_league_scores(v_league.id) s
      ) r
      join public.profiles p on p.id = r.uid
      where r.place <= v_winners and v_amounts[r.place] > 0
      returning *;
    end if;
  end loop;
end;
$$;

revoke all on function public.tregu_settle_due_leagues() from public, anon, authenticated;
grant execute on function public.tregu_settle_due_leagues() to service_role;
