-- 383 Tregu — leagues become a prediction game
--
-- Run once, in one transaction, like every other migration here.
--
-- Owner's rules, 29 Sep 2026:
--   * A league no longer scores coin profit, which let the biggest wallet win.
--     Members make one free pick per market in the league's scope. A correct
--     pick earns 100 minus the Tregu probability of that outcome at the moment
--     of the pick (a 60% favourite pays 40, a 15% underdog pays 85); a wrong
--     pick earns 0. Most points wins. Balance plays no part.
--   * Picks lock at kickoff (live_event.kickoff), the race start
--     (live_event.race_start), else the market's close. Only markets that lock
--     inside the league's window can be picked.
--   * A league settles once every picked market has resolved, or 48 hours after
--     it ends, whichever comes first; picks on markets still open then are void.
--   * Private pot: entry × members, plus a 383 bonus by length (up to a week
--     +10%, two weeks +15%, a month +25%), split 50/30/20 among members with
--     points. Nobody scores: every fee goes back.
--   * Duels are won on league points: whoever earns more from picks resolved in
--     the 24 hours takes both stakes.
--
-- Every reader of standings goes through tregu_league_scores(), so redefining
-- it (same signature, same columns) moves overview, standings, rank snapshots
-- and overtake events onto points at once. `net` is now points, `trades` the
-- number of correct picks.

-- ============================================================================
-- Picks
-- ============================================================================

create table if not exists public.tregu_league_picks (
  league_id uuid not null references public.tregu_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome text not null,
  -- The outcome's Tregu probability when picked, and the points it pays.
  probability numeric not null check (probability > 0 and probability < 1),
  points int not null check (points between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, market_id)
);
alter table public.tregu_league_picks enable row level security;
create index if not exists tregu_league_picks_market_idx on public.tregu_league_picks (market_id);

-- ============================================================================
-- Market helpers
-- ============================================================================

-- One outcome's LMSR probability. Binary markets keep PO/JO in q_yes/q_no;
-- every other type keeps a quantity per outcome key.
create or replace function public.tregu_outcome_probability(p_market public.markets, p_outcome text)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
  v_q numeric;
  v_target numeric;
  v_sum float8 := 0;
  v_b numeric := nullif(p_market.b, 0);
begin
  if v_b is null or p_market.outcomes is null or not (p_outcome = any(p_market.outcomes)) then
    return null;
  end if;
  v_target := case
    when p_market.market_type = 'binary' then case p_outcome when 'PO' then p_market.q_yes when 'JO' then p_market.q_no end
    else (p_market.outcome_quantities ->> p_outcome)::numeric
  end;
  if v_target is null then return null; end if;
  foreach v_key in array p_market.outcomes loop
    v_q := case
      when p_market.market_type = 'binary' then case v_key when 'PO' then p_market.q_yes when 'JO' then p_market.q_no end
      else (p_market.outcome_quantities ->> v_key)::numeric
    end;
    if v_q is null then return null; end if;
    -- Softmax relative to the target, so large quantities never overflow.
    v_sum := v_sum + exp(least(700, greatest(-700, ((v_q - v_target) / v_b)::float8)));
  end loop;
  return round((1 / v_sum)::numeric, 6);
end;
$$;

revoke all on function public.tregu_outcome_probability(public.markets, text) from public, anon, authenticated;

-- When picks close for a market: kickoff, race start, else its close.
create or replace function public.tregu_market_lock_at(p_live jsonb, p_closes timestamptz)
returns timestamptz
language sql
stable
as $$
  select coalesce(
    case when p_live ->> 'kickoff' ~ '^\d{4}-\d{2}-\d{2}T' then (p_live ->> 'kickoff')::timestamptz end,
    case when p_live ->> 'race_start' ~ '^\d{4}-\d{2}-\d{2}T' then (p_live ->> 'race_start')::timestamptz end,
    p_closes
  );
$$;

-- ============================================================================
-- Making a pick
-- ============================================================================

create or replace function public.tregu_league_pick(p_league_id uuid, p_market_id uuid, p_outcome text)
returns table (outcome text, points int, probability numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_market public.markets%rowtype;
  v_lock timestamptz;
  v_probability numeric;
  v_points int;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  select * into v_league from public.tregu_leagues l where l.id = p_league_id;
  if not found then raise exception 'Liga nuk u gjet.'; end if;
  if not exists (select 1 from public.tregu_league_members m where m.league_id = p_league_id and m.user_id = v_user) then
    raise exception 'Hyr në ligë për të parashikuar.';
  end if;
  if v_league.settled_at is not null or v_league.ends_at <= now() then raise exception 'Kjo ligë ka përfunduar.'; end if;
  if v_league.starts_at > now() then raise exception 'Liga nuk ka filluar ende.'; end if;

  select * into v_market from public.markets mk where mk.id = p_market_id;
  if not found or v_market.status <> 'open' then raise exception 'Ky treg nuk pranon më parashikime.'; end if;
  v_lock := public.tregu_market_lock_at(v_market.live_event, v_market.closes_at);
  if v_lock is null or v_lock <= now() then raise exception 'Parashikimet për këtë ndeshje janë mbyllur.'; end if;
  if v_lock > v_league.ends_at then raise exception 'Ky treg mbyllet pas ligës.'; end if;
  if not public.tregu_league_scope_match(v_league.scope_kind, v_league.scope_value, p_market_id) then
    raise exception 'Ky treg nuk numërohet në këtë ligë.';
  end if;
  if p_outcome is null or not (p_outcome = any(v_market.outcomes)) then raise exception 'Zgjedhje e pavlefshme.'; end if;

  v_probability := least(0.99, greatest(0.01, public.tregu_outcome_probability(v_market, p_outcome)));
  if v_probability is null then raise exception 'Çmimi i këtij tregu nuk lexohet. Provo përsëri.'; end if;
  v_points := greatest(1, least(99, round(100 * (1 - v_probability))))::int;

  insert into public.tregu_league_picks as p (league_id, user_id, market_id, outcome, probability, points)
  values (p_league_id, v_user, p_market_id, p_outcome, v_probability, v_points)
  on conflict (league_id, user_id, market_id) do update
    set outcome = excluded.outcome,
        probability = excluded.probability,
        points = excluded.points,
        updated_at = now();

  return query select p_outcome, v_points, v_probability;
end;
$$;

revoke all on function public.tregu_league_pick(uuid, uuid, text) from public, anon;
grant execute on function public.tregu_league_pick(uuid, uuid, text) to authenticated;

-- ============================================================================
-- The pick board: markets open for picks, then the caller's resolved picks
-- ============================================================================

create or replace function public.tregu_league_board(p_league_id uuid)
returns table (
  market_id uuid, slug text, question text, market_type text, lock_at timestamptz,
  status text, result_outcome text, options jsonb,
  my_outcome text, my_points int, result text
)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select l.* from public.tregu_leagues l
    where l.id = p_league_id
      and (l.kind = 'public' or exists (
        select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
      ))
  ),
  candidates as (
    select mk.*, public.tregu_market_lock_at(mk.live_event, mk.closes_at) as lock_at
    from lg
    join public.markets mk on mk.status = 'open'
    where public.tregu_league_scope_match(lg.scope_kind, lg.scope_value, mk.id)
  ),
  open_markets as (
    select c.* from candidates c, lg
    where c.lock_at > now() and c.lock_at >= lg.starts_at and c.lock_at <= lg.ends_at
    order by c.lock_at
    limit 40
  ),
  mine as (
    select p.* from public.tregu_league_picks p, lg
    where p.league_id = lg.id and p.user_id = auth.uid()
  ),
  shown as (
    select id from open_markets union select market_id from mine
  )
  select
    r.id, r.slug, r.question, r.market_type, lk.lock_at, r.status,
    case when r.status = 'resolved' then r.outcome end,
    (
      select jsonb_agg(jsonb_build_object(
        'key', u.k,
        'label', coalesce(s.so ->> 'label', s.so ->> 'team', case u.k when 'PO' then 'Po' when 'JO' then 'Jo' else u.k end),
        'color', s.so ->> 'color',
        'logo', s.so ->> 'logo',
        'prob', public.tregu_outcome_probability(r, u.k)
      ) order by u.ord)
      from unnest(r.outcomes) with ordinality u(k, ord)
      left join lateral (
        select e as so from jsonb_array_elements(coalesce(r.sport_outcomes, '[]'::jsonb)) e where e ->> 'key' = u.k limit 1
      ) s on true
    ),
    mi.outcome,
    mi.points,
    case
      when mi.outcome is null then case when lk.lock_at > now() and r.status = 'open' then 'open' else 'locked' end
      when r.status = 'resolved' and r.outcome = mi.outcome then 'won'
      when r.status = 'resolved' then 'lost'
      when r.status = 'stale' then 'void'
      when lk.lock_at > now() and r.status = 'open' then 'open'
      else 'locked'
    end
  from public.markets r
  cross join lateral (select public.tregu_market_lock_at(r.live_event, r.closes_at) as lock_at) lk
  left join mine mi on mi.market_id = r.id
  where r.id in (select id from shown)
  order by
    (r.status = 'resolved'),
    case when r.status = 'resolved' then null else lk.lock_at end asc,
    r.resolved_at desc nulls last
  limit 80;
$$;

grant execute on function public.tregu_league_board(uuid) to anon, authenticated;

-- ============================================================================
-- Scores: points from correct picks (same shape as before)
-- ============================================================================

create or replace function public.tregu_league_scores(p_league_id uuid)
returns table (uid uuid, net numeric, reached_at timestamptz, joined_at timestamptz, today_net numeric, trades int)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select p.user_id, case when mk.outcome = p.outcome then p.points else 0 end as pts, mk.resolved_at
    from public.tregu_league_picks p
    join public.markets mk on mk.id = p.market_id
    where p.league_id = p_league_id
      and mk.status = 'resolved'
      and mk.outcome is not null
  )
  select
    m.user_id,
    coalesce(sum(s.pts), 0)::numeric,
    max(s.resolved_at) filter (where s.pts > 0),
    m.joined_at,
    coalesce(sum(s.pts) filter (
      where (s.resolved_at at time zone 'Europe/Belgrade')::date = (now() at time zone 'Europe/Belgrade')::date
    ), 0)::numeric,
    (count(*) filter (where s.pts > 0))::int
  from public.tregu_league_members m
  left join scored s on s.user_id = m.user_id
  where m.league_id = p_league_id
  group by m.user_id, m.joined_at;
$$;

revoke all on function public.tregu_league_scores(uuid) from public, anon, authenticated;
grant execute on function public.tregu_league_scores(uuid) to service_role;

-- Resolved picks per member, for "7/10 të sakta" in the table, keyed like
-- the standings (tregu_member_key) because display names repeat.
create or replace function public.tregu_league_pick_counts(p_league_id uuid)
returns table (member_key text, is_me boolean, resolved int, correct int, pending int)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.tregu_member_key(p.league_id, p.user_id),
    coalesce(p.user_id = auth.uid(), false),
    (count(*) filter (where mk.status = 'resolved'))::int,
    (count(*) filter (where mk.status = 'resolved' and mk.outcome = p.outcome))::int,
    (count(*) filter (where mk.status = 'open'))::int
  from public.tregu_league_picks p
  join public.markets mk on mk.id = p.market_id
  join public.tregu_leagues l on l.id = p.league_id
  where p.league_id = p_league_id
    and (l.kind = 'public' or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  group by p.league_id, p.user_id;
$$;

grant execute on function public.tregu_league_pick_counts(uuid) to anon, authenticated;

-- ============================================================================
-- Private pot bonus
-- ============================================================================

-- 383's top-up on a private pot, in percent, by the league's length.
create or replace function public.tregu_private_bonus_pct(p_starts timestamptz, p_ends timestamptz)
returns int
language sql
immutable
as $$
  select case
    when extract(epoch from (p_ends - p_starts)) <= 7.5 * 86400 then 10
    when extract(epoch from (p_ends - p_starts)) <= 15 * 86400 then 15
    else 25
  end;
$$;

grant execute on function public.tregu_private_bonus_pct(timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- Settlement: points, the private bonus, and a wait for picked results
-- ============================================================================

create or replace function public.tregu_settle_due_leagues()
returns setof public.tregu_leaderboard_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.tregu_leagues%rowtype;
  v_pot numeric;
  v_purse numeric;
  v_winners int;
  v_shares numeric[];
  v_share_sum numeric;
  v_amounts numeric[];
  v_i int;
begin
  for v_league in
    select * from public.tregu_leagues l
    where l.settled_at is null and l.ends_at <= now()
      -- Give picked matches that kicked off before the end time to finish.
      and (l.ends_at <= now() - interval '48 hours' or not exists (
        select 1 from public.tregu_league_picks p
        join public.markets mk on mk.id = p.market_id
        where p.league_id = l.id and mk.status not in ('resolved', 'stale')
      ))
    order by l.ends_at
    for update skip locked
  loop
    update public.tregu_leagues set settled_at = now() where id = v_league.id;

    select coalesce(sum(fee_paid), 0) into v_pot
    from public.tregu_league_members where league_id = v_league.id;

    select least(3, count(*))::int into v_winners
    from public.tregu_league_scores(v_league.id) s where s.net > 0;

    if v_winners = 0 then
      -- Nobody scored: every fee goes back, straight to the wallet.
      update public.profiles p set coins = p.coins + m.fee_paid
      from public.tregu_league_members m
      where m.league_id = v_league.id and m.user_id = p.id and m.fee_paid > 0;
      insert into public.transactions (user_id, type, amount, meta)
      select m.user_id, 'league_fee', m.fee_paid, jsonb_build_object(
        'league_id', v_league.id,
        'note', format('Rimbursim: liga "%s" mbylli pa pikë', v_league.name))
      from public.tregu_league_members m
      where m.league_id = v_league.id and m.fee_paid > 0;
      continue;
    end if;

    -- Private: fees plus 383's bonus. Public: fees on top of 383's own prizes.
    v_purse := case when v_league.kind = 'private'
      then v_pot + floor(v_pot * public.tregu_private_bonus_pct(v_league.starts_at, v_league.ends_at) / 100.0)
      else v_pot end;

    v_shares := (array[50, 30, 20]::numeric[])[1:v_winners];
    select sum(x) into v_share_sum from unnest(v_shares) x;
    v_amounts := array[]::numeric[];
    for v_i in 1..v_winners loop
      v_amounts := v_amounts || floor(v_purse * v_shares[v_i] / v_share_sum);
    end loop;
    v_amounts[1] := v_amounts[1] + (v_purse - (select coalesce(sum(x), 0) from unnest(v_amounts) x));
    if v_league.kind = 'public' then
      for v_i in 1..v_winners loop
        v_amounts[v_i] := v_amounts[v_i] + coalesce(v_league.prizes[v_i], 0);
      end loop;
    end if;

    return query
    insert into public.tregu_leaderboard_rewards
      (period_kind, period_start, period_end, place, user_id, display_name, profit, prize,
       status, approved_at, league_id, league_name)
    select 'league', v_league.starts_at, v_league.ends_at, r.place, r.uid,
           coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
           round(r.net, 0), v_amounts[r.place],
           -- Private pots are the members' own money: paid straight away.
           -- Public prizes are 383's: they wait for the owner's confirmation.
           case when v_league.kind = 'private' then 'approved' else 'pending' end,
           case when v_league.kind = 'private' then now() end,
           v_league.id, v_league.name
    from (
      select s.uid, s.net,
        row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
      from public.tregu_league_scores(v_league.id) s
      where s.net > 0
    ) r
    join public.profiles p on p.id = r.uid
    where r.place <= v_winners and v_amounts[r.place] > 0
    returning *;
  end loop;
end;
$$;

revoke all on function public.tregu_settle_due_leagues() from public, anon, authenticated;
grant execute on function public.tregu_settle_due_leagues() to service_role;

-- ============================================================================
-- Duels on points
-- ============================================================================

-- Points a member earned in one league from picks resolved inside a window.
create or replace function public.tregu_pick_points_between(p_league uuid, p_user uuid, p_from timestamptz, p_to timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(p.points), 0)::numeric
  from public.tregu_league_picks p
  join public.markets mk on mk.id = p.market_id
  where p.league_id = p_league and p.user_id = p_user
    and mk.status = 'resolved' and mk.outcome = p.outcome
    and mk.resolved_at >= p_from and mk.resolved_at < p_to;
$$;
revoke all on function public.tregu_pick_points_between(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.tregu_my_duels()
returns table (
  id uuid, league_id uuid, league_name text, status text, stake numeric,
  i_am_challenger boolean, rival text, created_at timestamptz, ends_at timestamptz,
  my_net numeric, rival_net numeric, won boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id, d.league_id, l.name, d.status, d.stake,
    d.challenger = auth.uid(),
    public.tregu_duel_name(case when d.challenger = auth.uid() then d.opponent else d.challenger end),
    d.created_at, d.ends_at,
    case
      when d.status = 'active' then public.tregu_pick_points_between(d.league_id, auth.uid(), d.accepted_at, d.ends_at)
      when d.challenger = auth.uid() then d.challenger_net else d.opponent_net end,
    case
      when d.status = 'active' then public.tregu_pick_points_between(d.league_id, case when d.challenger = auth.uid() then d.opponent else d.challenger end, d.accepted_at, d.ends_at)
      when d.challenger = auth.uid() then d.opponent_net else d.challenger_net end,
    case when d.status = 'settled' then d.winner = auth.uid() end
  from public.tregu_duels d
  join public.tregu_leagues l on l.id = d.league_id
  where (d.challenger = auth.uid() or d.opponent = auth.uid())
    and (d.status in ('pending', 'active') or d.settled_at > now() - interval '7 days')
  order by (d.status not in ('pending', 'active')), d.created_at desc
  limit 20;
$$;
grant execute on function public.tregu_my_duels() to authenticated;

create or replace function public.tregu_settle_duels()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.tregu_duels%rowtype;
  v_c numeric;
  v_o numeric;
  v_winner uuid;
  v_loser uuid;
  v_done int := 0;
begin
  for v_duel in
    select * from public.tregu_duels where status = 'pending' and created_at <= now() - interval '24 hours' for update skip locked
  loop
    update public.tregu_duels set status = 'expired', settled_at = now() where id = v_duel.id;
    if v_duel.stake > 0 then
      update public.profiles set coins = coins + v_duel.stake where id = v_duel.challenger;
      insert into public.transactions (user_id, type, amount, meta)
      values (v_duel.challenger, 'duel_refund', v_duel.stake, jsonb_build_object('duel_id', v_duel.id, 'note', 'Sfida skadoi pa përgjigje'));
    end if;
    insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
    values (v_duel.challenger, v_duel.league_id, 'duel_expired', public.tregu_duel_name(v_duel.opponent), jsonb_build_object('duel_id', v_duel.id));
    v_done := v_done + 1;
  end loop;

  for v_duel in
    select * from public.tregu_duels where status = 'active' and ends_at <= now() for update skip locked
  loop
    v_c := public.tregu_pick_points_between(v_duel.league_id, v_duel.challenger, v_duel.accepted_at, v_duel.ends_at);
    v_o := public.tregu_pick_points_between(v_duel.league_id, v_duel.opponent, v_duel.accepted_at, v_duel.ends_at);
    v_winner := case when v_c > v_o then v_duel.challenger when v_o > v_c then v_duel.opponent end;
    update public.tregu_duels
    set status = 'settled', settled_at = now(), winner = v_winner, challenger_net = v_c, opponent_net = v_o
    where id = v_duel.id;

    if v_winner is null then
      if v_duel.stake > 0 then
        update public.profiles set coins = coins + v_duel.stake where id in (v_duel.challenger, v_duel.opponent);
        insert into public.transactions (user_id, type, amount, meta)
        select u, 'duel_refund', v_duel.stake, jsonb_build_object('duel_id', v_duel.id, 'note', 'Dueli mbaroi barazim')
        from unnest(array[v_duel.challenger, v_duel.opponent]) u;
      end if;
      insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
      select u, v_duel.league_id, 'duel_draw', public.tregu_duel_name(case when u = v_duel.challenger then v_duel.opponent else v_duel.challenger end),
        jsonb_build_object('duel_id', v_duel.id)
      from unnest(array[v_duel.challenger, v_duel.opponent]) u;
    else
      v_loser := case when v_winner = v_duel.challenger then v_duel.opponent else v_duel.challenger end;
      if v_duel.stake > 0 then
        update public.profiles set coins = coins + v_duel.stake * 2 where id = v_winner;
        insert into public.transactions (user_id, type, amount, meta)
        values (v_winner, 'duel_win', v_duel.stake * 2, jsonb_build_object('duel_id', v_duel.id,
          'note', format('Fitove duelin me %s', public.tregu_duel_name(v_loser))));
      end if;
      insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
      values
        (v_winner, v_duel.league_id, 'duel_won', public.tregu_duel_name(v_loser), jsonb_build_object('duel_id', v_duel.id, 'stake', v_duel.stake)),
        (v_loser, v_duel.league_id, 'duel_lost', public.tregu_duel_name(v_winner), jsonb_build_object('duel_id', v_duel.id, 'stake', v_duel.stake));
    end if;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;
revoke all on function public.tregu_settle_duels() from public, anon, authenticated;
grant execute on function public.tregu_settle_duels() to service_role;

-- ============================================================================
-- Home leaderboard: the caller's prize total
-- ============================================================================

create or replace function public.tregu_my_prize_total()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.amount), 0)
  from public.transactions t
  where t.user_id = auth.uid() and t.type in ('leaderboard_reward', 'league_reward');
$$;

grant execute on function public.tregu_my_prize_total() to authenticated;
