-- 383 Tregu — rank refresh without temporary tables
--
-- 0087's tregu_refresh_league_ranks() staged each league's standings in
-- temporary tables. It works from psql but failed (HTTP 400) when the
-- heartbeat called it through PostgREST, so no rank snapshots or overtake
-- events were ever written in production. This version does each league in
-- one statement of data-modifying CTEs: every part reads the same snapshot
-- of the previous ranks, which is exactly what "who passed whom" needs, and
-- nothing outlives the statement.

create or replace function public.tregu_refresh_league_ranks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league record;
  v_count int;
  v_events int := 0;
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
begin
  for v_league in
    select l.id, l.name from public.tregu_leagues l
    where l.settled_at is null and l.starts_at <= now() and l.ends_at > now()
  loop
    with cur as (
      select s.uid, s.net,
        row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
      from public.tregu_league_scores(v_league.id) s
    ),
    prev as (
      select r.user_id as uid, r.rank from public.tregu_league_ranks r where r.league_id = v_league.id
    ),
    dropped as (
      select c.uid, c.net, c.place, p.rank as was,
        (select c2.uid from cur c2 left join prev p2 on p2.uid = c2.uid
          where c2.place < c.place and coalesce(p2.rank, 999999) >= p.rank
          order by c2.place desc limit 1) as passer
      from cur c join prev p on p.uid = c.uid
      where c.place > p.rank
    ),
    overtaken as (
      insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
      select d.uid, v_league.id, 'overtaken',
        split_part(coalesce(nullif(trim(pr.display_name), ''), 'Tregtar'), ' ', 1),
        jsonb_build_object('league', v_league.name, 'from', d.was, 'to', d.place,
          'gap', round(greatest(pc.net - d.net, 0)) + 1)
      from dropped d
      join cur pc on pc.uid = d.passer
      join public.profiles pr on pr.id = d.passer
      returning 1
    ),
    climbed as (
      insert into public.tregu_league_events (user_id, league_id, kind, data)
      select c.uid, v_league.id, 'climbed', jsonb_build_object('league', v_league.name, 'from', p.rank, 'to', c.place)
      from cur c join prev p on p.uid = c.uid
      where c.place < p.rank
      returning 1
    ),
    saved as (
      insert into public.tregu_league_ranks (league_id, user_id, rank, profit, day_rank, day, updated_at)
      select v_league.id, c.uid, c.place, c.net, c.place, v_today, now() from cur c
      on conflict (league_id, user_id) do update set
        rank = excluded.rank,
        profit = excluded.profit,
        day_rank = case when tregu_league_ranks.day = v_today then tregu_league_ranks.day_rank else tregu_league_ranks.rank end,
        day = v_today,
        updated_at = now()
      returning 1
    )
    select (select count(*) from overtaken) + (select count(*) from climbed) + 0 * (select count(*) from saved)
      into v_count;
    v_events := v_events + v_count;
  end loop;
  return v_events;
end;
$$;

revoke all on function public.tregu_refresh_league_ranks() from public, anon, authenticated;
grant execute on function public.tregu_refresh_league_ranks() to service_role;
