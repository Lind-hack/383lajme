-- 383 Tregu — what the league picked, and what your rival picked
--
-- Run once, in one transaction, like every other migration here.
--
-- The pick board shows, for a match, how the league's members split across
-- its outcomes and which way the member just above you went. Both are hidden
-- until the caller has made their own pick on that match, or the match has
-- locked — so nobody can read the crowd first and copy it.

-- How the league split, per market and outcome. Members only; only markets
-- the caller has picked or that have locked.
create or replace function public.tregu_league_pick_split(p_league_id uuid)
returns table (market_id uuid, outcome text, picks int, total int)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  allowed as (
    select mk.id
    from public.markets mk
    where exists (select 1 from public.tregu_league_picks p where p.league_id = p_league_id and p.market_id = mk.id)
      and (
        exists (select 1 from public.tregu_league_picks p, me where p.league_id = p_league_id and p.market_id = mk.id and p.user_id = me.uid)
        or public.tregu_market_lock_at(mk.live_event, mk.closes_at) <= now()
        or mk.status <> 'open'
      )
  ),
  counts as (
    select p.market_id, p.outcome, count(*)::int as n
    from public.tregu_league_picks p
    where p.league_id = p_league_id and p.market_id in (select id from allowed)
    group by p.market_id, p.outcome
  )
  select c.market_id, c.outcome, c.n, (sum(c.n) over (partition by c.market_id))::int
  from counts c
  where exists (
    select 1 from public.tregu_league_members m, me where m.league_id = p_league_id and m.user_id = me.uid
  );
$$;
revoke all on function public.tregu_league_pick_split(uuid) from public, anon;
grant execute on function public.tregu_league_pick_split(uuid) to authenticated;

-- The member one place above the caller (or just below, for the leader), by
-- the live standings, and their picks on the markets the caller may see.
create or replace function public.tregu_league_rival_picks(p_league_id uuid)
returns table (rival_name text, rival_rank int, i_lead boolean, market_id uuid, outcome text)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select s.uid,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
    from public.tregu_league_scores(p_league_id) s
  ),
  mine as (
    select r.place from ranked r where r.uid = auth.uid()
  ),
  rival as (
    select r.uid, r.place, (m.place = 1) as i_lead
    from ranked r, mine m
    where r.place = case when m.place = 1 then 2 else m.place - 1 end
  )
  select
    split_part(coalesce(nullif(trim(pr.display_name), ''), 'Tregtar'), ' ', 1),
    rv.place,
    rv.i_lead,
    p.market_id,
    p.outcome
  from rival rv
  join public.profiles pr on pr.id = rv.uid
  join public.tregu_league_picks p on p.league_id = p_league_id and p.user_id = rv.uid
  join public.markets mk on mk.id = p.market_id
  where exists (select 1 from public.tregu_league_picks mp where mp.league_id = p_league_id and mp.market_id = p.market_id and mp.user_id = auth.uid())
     or public.tregu_market_lock_at(mk.live_event, mk.closes_at) <= now()
     or mk.status <> 'open';
$$;
revoke all on function public.tregu_league_rival_picks(uuid) from public, anon;
grant execute on function public.tregu_league_rival_picks(uuid) to authenticated;

notify pgrst, 'reload schema';
