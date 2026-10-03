-- 383 Tregu — the hub's day king counts real points, and the trader board
-- always shows you where you stand.
--
-- Run once, in one transaction, like every other migration here.
--
-- 1. 👑 Mbreti i ditës. 0095's hub summed plain pick points; since 0097 the
--    standings count 🔥 Seria and ⭐ Kartë e artë, so the crown could go to
--    someone below the day's real top scorer. The hub now sums
--    tregu_league_pick_effective(), the one definition the standings use.
--    Everything else in tregu_leagues_hub() is 0095 unchanged.
-- 2. Trader board. The caller's own row came back only with a profit, so a
--    trader down on the period read "—" and "+0" and could not tell a loss
--    from a broken board. Their row now always comes back, unranked
--    (rank null) when the period is not in profit. Prizes still rank only
--    net > 0.
-- 3. Scoring: realized profit, counted when it is realized. 0083 counted a
--    market only once the trader held nothing in it at all, so
--      * cashing out part of a position at a profit counted nothing while
--        any share was left, even when the rest was later held to a loss,
--      * selling one side while holding another hid the sale until the
--        market resolved, and
--      * a dust remainder after a coin-amount sell (> 0.000001 shares) kept
--        the market "open" and its profit off the board indefinitely.
--    Now each side of each market keeps an average cost: a sell realizes its
--    proceeds minus the cost of the shares sold, when it happens; a payout
--    realizes itself minus the remaining cost; a side still held when its
--    market resolves without paying it realizes minus its remaining cost at
--    the resolution. 0083's aims hold: a stake is not a loss when placed, and
--    a Sunday bet that wins on Monday lands wholly on Monday.
--    tregu_leaderboard_scores keeps its signature, so the board, the period
--    lock and prizes all move together. Periods already locked are not
--    re-judged.

-- ============================================================================
-- 1. Hub: day king on effective points
-- ============================================================================

create or replace function public.tregu_leagues_hub()
returns table (
  section text,
  id uuid, name text, kind text, listed boolean, code text,
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, is_creator boolean,
  my_rank int, my_points numeric, my_rank_change int, gap_to_podium numeric, ranks_ready boolean,
  top3 jsonb, day_king text, day_king_points numeric,
  open_count int, picked_count int, next_lock_at timestamptz, active_today int,
  emblem text, color text, scope_kind text, scope_value text,
  sponsor text, sponsor_logo text, sponsor_url text,
  featured boolean, feature_order int, settled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select m.league_id, count(*)::int as n
    from public.tregu_league_members m
    group by m.league_id
  ),
  activity as (
    select p.league_id, count(distinct p.user_id)::int as n
    from public.tregu_league_picks p
    where p.updated_at > now() - interval '24 hours'
    group by p.league_id
  ),
  base as (
    select l.*, coalesce(c.n, 0) as n_members, coalesce(a.n, 0) as n_active,
      exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()) as member
    from public.tregu_leagues l
    left join counts c on c.league_id = l.id
    left join activity a on a.league_id = l.id
    where l.settled_at is null and l.ends_at > now()
  ),
  picked as (
    -- Every league the reader is in, plus 383's three and the five busiest
    -- public leagues they are not in yet.
    select 'mine'::text as section, b.*, 0 as ord from base b where b.member
    union all
    select * from (
      select 'official'::text, b.*, row_number() over (
          order by b.featured desc, b.feature_order, b.n_members desc)::int as ord
      from base b
      where b.kind = 'public' and not b.member
    ) o where o.ord <= 3
    union all
    select * from (
      select 'open'::text, b.*, row_number() over (
          order by b.n_active desc, b.n_members desc, b.entry_fee * b.n_members desc, b.created_at desc)::int as ord
      from base b
      where b.listed and not b.member
        and b.ends_at > now() + interval '24 hours'
        and b.n_members < b.max_members
        and not (b.n_members <= 1 and b.created_at < now() - interval '3 days')
    ) o where o.ord <= 5
  ),
  -- Ranks: the cached table the heartbeat refreshes; a league it has not seen
  -- yet is scored live, at most twelve per call.
  cached as (
    select r.league_id, r.user_id, r.rank, r.profit, r.day_rank
    from public.tregu_league_ranks r
    where r.league_id in (select p.id from picked p)
  ),
  uncached as (
    select p.id from picked p
    where not exists (select 1 from cached c where c.league_id = p.id)
    order by p.ends_at
    limit 12
  ),
  live as (
    select u.id as league_id, s.uid as user_id,
      row_number() over (partition by u.id order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as rank,
      s.net as profit
    from uncached u
    cross join lateral public.tregu_league_scores(u.id) s
  ),
  ranks as (
    select c.league_id, c.user_id, c.rank, c.profit, c.day_rank from cached c
    union all
    select l.league_id, l.user_id, l.rank, l.profit, l.rank from live l
  ),
  podium as (
    select r.league_id,
      jsonb_agg(jsonb_build_object(
        'rank', r.rank,
        'name', split_part(coalesce(nullif(trim(pr.display_name), ''), 'Tregtar'), ' ', 1),
        'points', round(r.profit, 0),
        'me', r.user_id = auth.uid()
      ) order by r.rank) as top3,
      max(r.profit) filter (where r.rank = 3) as third
    from ranks r
    join public.profiles pr on pr.id = r.user_id
    where r.rank <= 3
    group by r.league_id
  ),
  me as (
    select r.league_id, r.rank, r.profit, r.day_rank - r.rank as change
    from ranks r where r.user_id = auth.uid()
  ),
  king as (
    -- What each correct pick actually scored today: 🔥 Seria and ⭐ Kartë e
    -- artë included (0097), so the crown agrees with the standings beside it.
    -- A v1 league's effective points equal its plain points.
    select distinct on (k.league_id) k.league_id, k.name, k.pts
    from (
      select pk.id as league_id, e.user_id,
        split_part(coalesce(nullif(trim(pr.display_name), ''), 'Tregtar'), ' ', 1) as name,
        sum(e.effective)::numeric as pts
      from picked pk
      cross join lateral public.tregu_league_pick_effective(pk.id) e
      join public.profiles pr on pr.id = e.user_id
      where e.correct
        and public.tregu_kosovo_day(e.resolved_at) = public.tregu_kosovo_day()
      group by pk.id, e.user_id, pr.display_name
    ) k
    order by k.league_id, k.pts desc, k.name
  ),
  today as (
    select pk.id as league_id,
      count(*)::int as open_count,
      (count(*) filter (where pp.market_id is not null))::int as picked_count,
      min(o.lock_at) filter (where pp.market_id is null) as next_lock_at
    from picked pk
    cross join lateral public.tregu_league_open_markets(pk.id, now() + interval '24 hours') o
    left join public.tregu_league_picks pp
      on pp.league_id = pk.id and pp.user_id = auth.uid() and pp.market_id = o.market_id
    where pk.section = 'mine' and pk.starts_at <= now()
    group by pk.id
  )
  select
    p.section,
    p.id, p.name, p.kind, p.listed,
    case when p.member then p.code end,
    p.starts_at, p.ends_at, p.created_at,
    p.entry_fee, p.prizes, public.tregu_league_pot(p.id), p.n_members, p.max_members,
    p.member, coalesce(p.creator_id = auth.uid(), false),
    me.rank, round(me.profit, 0), coalesce(me.change, 0),
    case when me.rank is null then null when me.rank <= 3 then 0
      else greatest(round(coalesce(pod.third, 0) - me.profit, 0), 0) + 1 end,
    exists (select 1 from ranks r where r.league_id = p.id),
    coalesce(pod.top3, '[]'::jsonb), k.name, k.pts,
    coalesce(t.open_count, 0), coalesce(t.picked_count, 0), t.next_lock_at, p.n_active,
    p.emblem, p.color, p.scope_kind, p.scope_value,
    p.sponsor, p.sponsor_logo, p.sponsor_url,
    p.featured, p.feature_order, p.settled_at is not null
  from picked p
  left join podium pod on pod.league_id = p.id
  left join me on me.league_id = p.id
  left join king k on k.league_id = p.id
  left join today t on t.league_id = p.id
  order by p.section, p.ord, p.ends_at;
$$;
grant execute on function public.tregu_leagues_hub() to anon, authenticated;


-- ============================================================================
-- 3. Scores: realized P&L per side, average cost
-- ============================================================================

-- Internal: one row per realization (user, market, amount, when), replayed
-- from the whole ledger so cost bases are right, emitted only inside the
-- window.
create or replace function public.tregu_realized_trades(p_from timestamptz, p_to timestamptz)
returns table (uid uuid, mid uuid, pnl numeric, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_key text := null;
  v_uid uuid;
  v_mid uuid;
  v_status text;
  v_settled timestamptz;
  v_last timestamptz;
  v_shares numeric := 0;
  v_cost numeric := 0;
  v_take numeric;
  v_sold numeric;
begin
  for r in
    select t.user_id, t.market_id, coalesce(t.meta->>'side', '') as side, t.type,
      t.amount::numeric as amount, t.created_at,
      case when (t.meta->>'shares') ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' then (t.meta->>'shares')::numeric end as shares,
      m.status, coalesce(m.resolved_at, m.updated_at) as settled_at
    from public.transactions t
    join public.markets m on m.id = t.market_id
    where t.type in ('bet', 'sell', 'payout') and t.market_id is not null
    order by t.user_id, t.market_id, side, t.created_at, t.id
  loop
    if v_key is distinct from (r.user_id::text || r.market_id::text || r.side) then
      -- Close the previous side: held into a resolution that did not pay it.
      if v_key is not null and v_status = 'resolved' and v_cost > 0.000001 then
        uid := v_uid; mid := v_mid; pnl := -v_cost; at := greatest(v_settled, v_last);
        if at >= p_from and at < p_to then return next; end if;
      end if;
      v_key := r.user_id::text || r.market_id::text || r.side;
      v_uid := r.user_id; v_mid := r.market_id; v_status := r.status; v_settled := r.settled_at;
      v_shares := 0; v_cost := 0;
    end if;
    v_last := r.created_at;

    if r.type = 'bet' then
      v_shares := v_shares + coalesce(r.shares, 0);
      v_cost := v_cost + abs(r.amount);
    elsif r.type = 'sell' then
      v_sold := coalesce(r.shares, v_shares);
      -- Selling (almost) everything takes the whole basis, so no dust of
      -- cost is left to resurface as a loss at resolution.
      v_take := case when v_shares <= 0.000001 or v_sold >= v_shares - 0.000001 then v_cost
                     else v_cost * v_sold / v_shares end;
      uid := r.user_id; mid := r.market_id; pnl := r.amount - v_take; at := r.created_at;
      if at >= p_from and at < p_to then return next; end if;
      v_cost := v_cost - v_take;
      v_shares := greatest(0, v_shares - v_sold);
    else -- payout: the side won; whatever is left of its cost is settled here
      uid := r.user_id; mid := r.market_id; pnl := r.amount - v_cost; at := r.created_at;
      if at >= p_from and at < p_to then return next; end if;
      v_cost := 0;
      v_shares := 0;
    end if;
  end loop;

  if v_key is not null and v_status = 'resolved' and v_cost > 0.000001 then
    uid := v_uid; mid := v_mid; pnl := -v_cost; at := greatest(v_settled, v_last);
    if at >= p_from and at < p_to then return next; end if;
  end if;
end;
$$;

revoke all on function public.tregu_realized_trades(timestamptz, timestamptz) from public, anon, authenticated;

-- Same signature as 0083: the board, the period lock and prizes read this.
-- reached_at is when the trader's last realization in the period landed,
-- which breaks ties as before (whoever got there first ranks higher).
create or replace function public.tregu_leaderboard_scores(p_from timestamptz, p_to timestamptz)
returns table (uid uuid, net numeric, reached_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.uid, sum(r.pnl), max(r.at)
  from public.tregu_realized_trades(p_from, p_to) r
  group by r.uid;
$$;

revoke all on function public.tregu_leaderboard_scores(timestamptz, timestamptz) from public, anon, authenticated;

-- ============================================================================
-- 2. Trader board: your own row, profit or not
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
  scores as (
    select s.*
    from bounds b
    cross join lateral public.tregu_leaderboard_scores(b.period_start, b.period_end) s
  ),
  ranked as (
    select
      -- Equal profit: whoever got there first ranks higher.
      row_number() over (order by s.net desc, s.reached_at asc, s.uid) as place,
      s.uid,
      s.net
    from scores s
    where s.net > 0
  ),
  board as (
    select r.place, r.uid, r.net
    from ranked r
    where r.place <= greatest(1, p_limit) or r.uid = auth.uid()
    union all
    -- Closed trades this period, but not in profit: shown to its owner only,
    -- without a place, because places are what the prizes pay.
    select null::bigint, s.uid, s.net
    from scores s
    where s.uid = auth.uid() and s.net <= 0
  )
  select
    b.place,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    round(b.net, 0),
    (b.uid = auth.uid())
  from board b
  join public.profiles p on p.id = b.uid
  order by b.place nulls last;
$$;

grant execute on function public.tregu_leaderboard_board(text, int) to anon, authenticated;

notify pgrst, 'reload schema';
