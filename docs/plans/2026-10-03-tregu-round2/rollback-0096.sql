-- Rollback for 0096: restores the pre-0096 definitions the live site depends on.

-- Only for a failed smoke test right after applying 0096. Added columns and

-- event kinds stay; without the functions below using them they are inert.

begin;

drop function if exists public.tregu_league_pick(uuid, uuid, text, boolean);

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

drop function if exists public.tregu_league_board(uuid);

create function public.tregu_league_board(p_league_id uuid)
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

drop function if exists public.tregu_queue_pick_results();

drop function if exists public.tregu_my_recent_results(timestamptz);

drop function if exists public.tregu_league_my_streak(uuid);

notify pgrst, 'reload schema';

commit;
