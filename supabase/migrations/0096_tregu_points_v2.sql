-- 383 Tregu — points v2: 🔥 Seria and ⭐ Kartë e artë, results, win pushes
--
-- Run once, in one transaction, like every other migration here.
-- Plan: docs/plans/2026-10-03-tregu-round2/PLAN.md (owner's rules, 3 Oct 2026).
--
-- Activates NOTHING by itself: rules_version defaults to 1 here, so every
-- league keeps today's scoring until 0097 flips the default to 2 (applied
-- only once the new UI is live). In a v2 league:
--   * 🔥 Seria — a member's consecutive correct picks in that league, counted
--     including the pick being scored: the 3rd and 4th in a row pay ×1.5, the
--     5th and beyond ×2. A wrong pick resets it; void/stale picks are neutral.
--     Picks that resolve at the same instant are one batch: each correct one
--     is scored from the streak before the batch (+1), and a wrong one in the
--     batch resets it afterwards — no id order ever decides points.
--   * ⭐ Kartë e artë — once per league per Kosovo day (the day the match
--     locks), a member marks one pick to count double. Wrong still pays 0.
-- Duels keep raw points (tregu_pick_points_between is unchanged).
-- v1 (every league that exists today): correct = points, wrong = 0.

-- ============================================================================
-- Columns
-- ============================================================================

alter table public.tregu_leagues
  add column if not exists rules_version int not null default 1 check (rules_version in (1, 2));

alter table public.tregu_league_picks
  add column if not exists boosted boolean not null default false,
  add column if not exists lock_day date,
  add column if not exists result_notified_at timestamptz;

-- The day a pick belongs to: the Kosovo day its market locks. Set on every
-- insert (tregu_league_pick, tregu_league_copy_picks, anything later) so the
-- one-card-a-day rule can never be dodged by a missing day.
create or replace function public.tregu_league_pick_set_day()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.lock_day is null or tg_op = 'UPDATE' and new.market_id is distinct from old.market_id then
    select public.tregu_kosovo_day(public.tregu_market_lock_at(mk.live_event, mk.closes_at))
      into new.lock_day
    from public.markets mk where mk.id = new.market_id;
  end if;
  return new;
end;
$$;
drop trigger if exists tregu_league_pick_set_day on public.tregu_league_picks;
create trigger tregu_league_pick_set_day
  before insert or update on public.tregu_league_picks
  for each row execute function public.tregu_league_pick_set_day();

update public.tregu_league_picks p
set lock_day = public.tregu_kosovo_day(public.tregu_market_lock_at(mk.live_event, mk.closes_at))
from public.markets mk
where mk.id = p.market_id and p.lock_day is null;

-- Picks that resolved before today never send a "you won" push.
update public.tregu_league_picks p
set result_notified_at = now()
from public.markets mk
where mk.id = p.market_id and mk.status in ('resolved', 'stale') and p.result_notified_at is null;

alter table public.tregu_league_picks drop constraint if exists tregu_league_picks_boost_day_check;
alter table public.tregu_league_picks add constraint tregu_league_picks_boost_day_check
  check (not boosted or lock_day is not null);
create unique index if not exists tregu_league_picks_one_boost_per_day
  on public.tregu_league_picks (league_id, user_id, lock_day) where boosted;

-- ============================================================================
-- Points: one definition of what each resolved pick is worth
-- ============================================================================

create or replace function public.tregu_streak_multiplier(p_streak int)
returns numeric
language sql
immutable
as $$
  select case when p_streak >= 5 then 2.0 when p_streak >= 3 then 1.5 else 1.0 end;
$$;

-- One row per resolved pick in the league: what it earned, the streak it was
-- scored at (including itself; 0 when wrong) and whether it carried the card.
create or replace function public.tregu_league_pick_effective(p_league_id uuid)
returns table (user_id uuid, market_id uuid, resolved_at timestamptz, correct boolean,
               boosted boolean, streak int, base int, effective int)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select coalesce(l.rules_version, 1) as v from public.tregu_leagues l where l.id = p_league_id
  ),
  res as (
    select p.user_id, p.market_id, p.points, p.boosted, mk.resolved_at,
      (mk.outcome = p.outcome) as correct
    from public.tregu_league_picks p
    join public.markets mk on mk.id = p.market_id
    where p.league_id = p_league_id and mk.status = 'resolved' and mk.outcome is not null
  ),
  batches as (
    select r.user_id, r.resolved_at,
      (count(*) filter (where r.correct))::int as n_correct,
      bool_or(not r.correct) as any_wrong
    from res r
    group by r.user_id, r.resolved_at
  ),
  counted as (
    select b.*,
      (sum(case when b.any_wrong then 1 else 0 end) over (partition by b.user_id order by b.resolved_at))::int as wrong_incl
    from batches b
  ),
  streaks as (
    -- Correct picks since the last batch that had a wrong one.
    select c.user_id, c.resolved_at,
      coalesce(sum(case when c.any_wrong then 0 else c.n_correct end) over (
        partition by c.user_id, c.wrong_incl - case when c.any_wrong then 1 else 0 end
        order by c.resolved_at
        rows between unbounded preceding and 1 preceding
      ), 0)::int as before
    from counted c
  )
  select r.user_id, r.market_id, r.resolved_at, r.correct, r.boosted,
    case when r.correct then s.before + 1 else 0 end,
    r.points,
    case
      when not r.correct then 0
      when lg.v < 2 then r.points
      else round(r.points * public.tregu_streak_multiplier(s.before + 1) * case when r.boosted then 2 else 1 end)::int
    end
  from res r
  join streaks s on s.user_id = r.user_id and s.resolved_at = r.resolved_at
  cross join lg;
$$;
revoke all on function public.tregu_league_pick_effective(uuid) from public, anon, authenticated;

-- Same signature and columns as 0089: everything that reads standings
-- (overview, hub, standings, ranks, settlement, emails) moves at once.
create or replace function public.tregu_league_scores(p_league_id uuid)
returns table (uid uuid, net numeric, reached_at timestamptz, joined_at timestamptz, today_net numeric, trades int)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select e.user_id, e.effective as pts, e.resolved_at
    from public.tregu_league_pick_effective(p_league_id) e
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

-- The caller's streak in a league, what the next correct pick earns, and
-- whether today's card is spent.
create or replace function public.tregu_league_my_streak(p_league_id uuid)
returns table (rules_version int, streak int, next_mult numeric, boost_used_today boolean)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select coalesce(l.rules_version, 1) as v from public.tregu_leagues l where l.id = p_league_id
  ),
  mine as (
    select e.* from public.tregu_league_pick_effective(p_league_id) e where e.user_id = auth.uid()
  ),
  last_batch as (
    select m.resolved_at, bool_or(not m.correct) as any_wrong, max(m.streak) as top
    from mine m
    group by m.resolved_at
    order by m.resolved_at desc
    limit 1
  ),
  cur as (
    select coalesce((select case when lb.any_wrong then 0 else lb.top end from last_batch lb), 0)::int as s
  )
  select lg.v, cur.s, public.tregu_streak_multiplier(cur.s + 1),
    exists (
      select 1 from public.tregu_league_picks p
      where p.league_id = p_league_id and p.user_id = auth.uid() and p.boosted
        and p.lock_day = public.tregu_kosovo_day()
    )
  from lg, cur
  where auth.uid() is not null;
$$;
grant execute on function public.tregu_league_my_streak(uuid) to authenticated;

-- ============================================================================
-- Picking, with the card
-- ============================================================================

drop function if exists public.tregu_league_pick(uuid, uuid, text);
create function public.tregu_league_pick(p_league_id uuid, p_market_id uuid, p_outcome text, p_boost boolean default null)
returns table (outcome text, points int, probability numeric, boosted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_market public.markets%rowtype;
  v_lock timestamptz;
  v_day date;
  v_probability numeric;
  v_points int;
  v_other record;
  v_boosted boolean;
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
  if p_boost is true and coalesce(v_league.rules_version, 1) < 2 then
    raise exception 'Karta e artë vlen vetëm në ligat e reja.';
  end if;

  v_probability := least(0.99, greatest(0.01, public.tregu_outcome_probability(v_market, p_outcome)));
  if v_probability is null then raise exception 'Çmimi i këtij tregu nuk lexohet. Provo përsëri.'; end if;
  v_points := greatest(1, least(99, round(100 * (1 - v_probability))))::int;
  v_day := public.tregu_kosovo_day(v_lock);

  if p_boost is true then
    -- One card per league per day: two tabs must not both move it.
    perform pg_advisory_xact_lock(hashtext('tregu_boost:' || p_league_id::text || ':' || v_user::text || ':' || v_day::text));
    select p.market_id, public.tregu_market_lock_at(mk.live_event, mk.closes_at) as lock_at, mk.status
      into v_other
    from public.tregu_league_picks p
    join public.markets mk on mk.id = p.market_id
    where p.league_id = p_league_id and p.user_id = v_user and p.lock_day = v_day
      and p.boosted and p.market_id <> p_market_id
    for update of p;
    if found then
      if v_other.status <> 'open' or v_other.lock_at <= now() then
        raise exception 'Karta e artë e sotme është përdorur.';
      end if;
      update public.tregu_league_picks p set boosted = false, updated_at = now()
      where p.league_id = p_league_id and p.user_id = v_user and p.market_id = v_other.market_id;
    end if;
  end if;

  insert into public.tregu_league_picks as p (league_id, user_id, market_id, outcome, probability, points, lock_day, boosted)
  values (p_league_id, v_user, p_market_id, p_outcome, v_probability, v_points, v_day, coalesce(p_boost, false))
  on conflict (league_id, user_id, market_id) do update
    set outcome = excluded.outcome,
        probability = excluded.probability,
        points = excluded.points,
        lock_day = excluded.lock_day,
        -- null keeps the card where it is: a re-pick never drops it.
        boosted = case when p_boost is null then p.boosted else p_boost end,
        updated_at = now()
  returning p.boosted into v_boosted;

  return query select p_outcome, v_points, v_probability, v_boosted;
end;
$$;
revoke all on function public.tregu_league_pick(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.tregu_league_pick(uuid, uuid, text, boolean) to authenticated;

-- ============================================================================
-- The board gains the card, the version and the day
-- ============================================================================

drop function if exists public.tregu_league_board(uuid);
create function public.tregu_league_board(p_league_id uuid)
returns table (
  market_id uuid, slug text, question text, market_type text, lock_at timestamptz,
  status text, result_outcome text, options jsonb,
  my_outcome text, my_points int, result text,
  my_boosted boolean, rules_version int, lock_day date, my_effective int
)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select l.* from public.tregu_leagues l
    where l.id = p_league_id
      and (l.kind = 'public' or l.listed or exists (
        select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
      ))
  ),
  open_markets as (
    select o.market_id as id, o.lock_at
    from lg cross join lateral public.tregu_league_open_markets(lg.id, 'infinity'::timestamptz) o
    order by o.lock_at
    limit 40
  ),
  mine as (
    select p.* from public.tregu_league_picks p, lg
    where p.league_id = lg.id and p.user_id = auth.uid()
  ),
  earned as (
    select e.market_id, e.effective from public.tregu_league_pick_effective(p_league_id) e
    where e.user_id = auth.uid()
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
    end,
    coalesce(mi.boosted, false),
    (select coalesce(lg.rules_version, 1) from lg),
    public.tregu_kosovo_day(lk.lock_at),
    ea.effective
  from public.markets r
  cross join lateral (select public.tregu_market_lock_at(r.live_event, r.closes_at) as lock_at) lk
  left join mine mi on mi.market_id = r.id
  left join earned ea on ea.market_id = r.id
  where r.id in (select id from shown)
  order by
    (r.status = 'resolved'),
    case when r.status = 'resolved' then null else lk.lock_at end asc,
    r.resolved_at desc nulls last
  limit 80;
$$;
grant execute on function public.tregu_league_board(uuid) to anon, authenticated;

-- ============================================================================
-- "Rezultatet e tua": what resolved for the caller since they last looked
-- ============================================================================

create or replace function public.tregu_my_recent_results(p_since timestamptz)
returns table (kind text, league_id uuid, league_name text, question text, slug text,
               picked text, won boolean, amount numeric, boosted boolean, streak int, at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with my_leagues as (
    select distinct p.league_id
    from public.tregu_league_picks p
    join public.markets mk on mk.id = p.market_id
    where p.user_id = auth.uid() and mk.status = 'resolved' and mk.resolved_at > p_since
  ),
  picks as (
    select 'pick'::text as kind, l.id as league_id, l.name as league_name, mk.question, mk.slug,
      coalesce(
        (select so ->> 'label' from jsonb_array_elements(coalesce(mk.sport_outcomes, '[]'::jsonb)) so where so ->> 'key' = p.outcome limit 1),
        case p.outcome when 'PO' then 'Po' when 'JO' then 'Jo' else p.outcome end
      ) as picked,
      e.correct as won, e.effective::numeric as amount, e.boosted, e.streak, e.resolved_at as at
    from my_leagues ml
    join public.tregu_leagues l on l.id = ml.league_id
    cross join lateral public.tregu_league_pick_effective(ml.league_id) e
    join public.tregu_league_picks p on p.league_id = ml.league_id and p.user_id = e.user_id and p.market_id = e.market_id
    join public.markets mk on mk.id = e.market_id
    where e.user_id = auth.uid() and e.resolved_at > p_since
  ),
  trades as (
    select 'trade'::text, null::uuid, null::text, mk.question, mk.slug,
      case t.meta ->> 'side' when 'PO' then 'Po' when 'JO' then 'Jo' else t.meta ->> 'side' end,
      true, t.amount, false, 0, t.created_at
    from public.transactions t
    left join public.markets mk on mk.id = t.market_id
    where t.user_id = auth.uid() and t.type = 'payout' and t.amount > 0 and t.created_at > p_since
  )
  select * from (select * from picks union all select * from trades) x
  where auth.uid() is not null
  order by x.won desc, x.at desc
  limit 20;
$$;
grant execute on function public.tregu_my_recent_results(timestamptz) to authenticated;

-- ============================================================================
-- Win pushes
-- ============================================================================

alter table public.tregu_league_events drop constraint if exists tregu_league_events_kind_check;
alter table public.tregu_league_events add constraint tregu_league_events_kind_check
  check (kind in ('overtaken', 'climbed', 'duel_challenge', 'duel_accepted', 'duel_declined',
                  'duel_won', 'duel_lost', 'duel_draw', 'duel_expired', 'picks_due',
                  'picks_won', 'trade_won'));
alter table public.tregu_league_events drop constraint if exists tregu_league_events_trade_won_txn_check;
alter table public.tregu_league_events add constraint tregu_league_events_trade_won_txn_check
  check (kind <> 'trade_won' or data ? 'txn');
create unique index if not exists tregu_league_events_trade_won_txn_key
  on public.tregu_league_events ((data ->> 'txn')) where kind = 'trade_won';

-- Heartbeat job. Claims every resolved pick once (stamping it, won or lost,
-- pushed or not, so nothing is rescanned), then queues one "picks_won" per
-- member per league for readers with push on, and one "trade_won" per payout.
-- All of it is this one function call, i.e. one transaction: if an insert
-- fails, the claim rolls back with it.
create or replace function public.tregu_queue_pick_results()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_trades int := 0;
begin
  with claimed as (
    update public.tregu_league_picks p
    set result_notified_at = now()
    from public.markets mk
    where mk.id = p.market_id
      and p.result_notified_at is null
      and mk.status in ('resolved', 'stale')
      and mk.resolved_at > now() - interval '6 hours'
    returning p.league_id, p.user_id, p.market_id
  ),
  won as (
    select c.league_id, c.user_id, c.market_id, e.effective, mk.question
    from claimed c
    join lateral public.tregu_league_pick_effective(c.league_id) e
      on e.user_id = c.user_id and e.market_id = c.market_id
    join public.markets mk on mk.id = c.market_id
    where e.correct
      and exists (select 1 from public.tregu_push_subscriptions s where s.user_id = c.user_id)
  ),
  grouped as (
    select w.user_id, w.league_id, count(*)::int as n, sum(w.effective)::int as pts, min(w.question) as question
    from won w
    group by w.user_id, w.league_id
  ),
  queued as (
    insert into public.tregu_league_events (user_id, league_id, kind, data)
    select g.user_id, g.league_id, 'picks_won', jsonb_build_object(
      'count', g.n, 'points', g.pts, 'league', l.name,
      'question', case when g.n = 1 then g.question end)
    from grouped g
    join public.tregu_leagues l on l.id = g.league_id
    returning 1
  )
  select count(*)::int into v_count from queued;

  with queued as (
    insert into public.tregu_league_events (user_id, kind, data)
    select t.user_id, 'trade_won', jsonb_build_object(
      'txn', t.id::text, 'amount', round(t.amount, 0), 'question', mk.question, 'slug', mk.slug)
    from public.transactions t
    left join public.markets mk on mk.id = t.market_id
    where t.type = 'payout' and t.amount > 0
      and t.created_at > now() - interval '6 hours'
      and exists (select 1 from public.tregu_push_subscriptions s where s.user_id = t.user_id)
    on conflict ((data ->> 'txn')) where kind = 'trade_won' do nothing
    returning 1
  )
  select count(*)::int into v_trades from queued;

  return v_count + v_trades;
end;
$$;
revoke all on function public.tregu_queue_pick_results() from public, anon, authenticated;
grant execute on function public.tregu_queue_pick_results() to service_role;

notify pgrst, 'reload schema';
