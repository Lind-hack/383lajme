-- 383 Tregu — copy a league's picks into the reader's other leagues of the same kind
--
-- Run once, in one transaction, like every other migration here.
--
-- A reader in three football leagues had to make every prediction three times.
-- tregu_league_copy_picks(source) takes their open picks in one league and
-- writes them into every other active league they belong to *of the same kind*
-- (football into football, never into basketball, Kosovë or Shqipëri). Each
-- copied pick passes exactly the checks a manual pick does, and scores at the
-- odds of the moment it is copied, like any pick made now. A match the reader
-- already picked in the target league is never overwritten.
--
-- p_dry_run = true only counts, for the button's label.

-- Which leagues are "the same kind": the family of a league's scope.
create or replace function public.tregu_league_family(p_kind text, p_value text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_kind, 'all') = 'all' then 'all'
    when p_kind = 'f1' then 'f1'
    when p_kind = 'competition' and p_value in ('nba', 'fbk.kosovo', 'fiba.world') then 'basketball'
    when p_kind = 'competition' then 'football'
    when p_kind = 'category' then 'category:' || lower(coalesce(p_value, ''))
    else 'other:' || coalesce(p_kind, '')
  end;
$$;

create or replace function public.tregu_league_copy_picks(p_league_id uuid, p_dry_run boolean default false)
returns table (league_id uuid, league_name text, copied int, skipped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_source public.tregu_leagues%rowtype;
  v_family text;
  v_target public.tregu_leagues%rowtype;
  v_pick record;
  v_market public.markets%rowtype;
  v_lock timestamptz;
  v_probability numeric;
  v_copied int;
  v_skipped int;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  select * into v_source from public.tregu_leagues l where l.id = p_league_id;
  if not found then raise exception 'Liga nuk u gjet.'; end if;
  if not exists (select 1 from public.tregu_league_members m where m.league_id = p_league_id and m.user_id = v_user) then
    raise exception 'Hyr në ligë për të parashikuar.';
  end if;
  v_family := public.tregu_league_family(v_source.scope_kind, v_source.scope_value);

  for v_target in
    select l.* from public.tregu_leagues l
    join public.tregu_league_members m on m.league_id = l.id and m.user_id = v_user
    where l.id <> p_league_id
      and l.settled_at is null
      and l.starts_at <= now()
      and l.ends_at > now()
      and public.tregu_league_family(l.scope_kind, l.scope_value) = v_family
    order by l.ends_at
  loop
    v_copied := 0;
    v_skipped := 0;
    for v_pick in
      select p.market_id, p.outcome from public.tregu_league_picks p
      where p.league_id = p_league_id and p.user_id = v_user
    loop
      select * into v_market from public.markets mk where mk.id = v_pick.market_id;
      if not found or v_market.status <> 'open' then continue; end if;
      v_lock := public.tregu_market_lock_at(v_market.live_event, v_market.closes_at);
      -- Settled or started matches are not "open picks"; they are not counted.
      if v_lock is null or v_lock <= now() then continue; end if;
      if v_lock > v_target.ends_at
        or not public.tregu_league_scope_match(v_target.scope_kind, v_target.scope_value, v_pick.market_id)
        or exists (
          select 1 from public.tregu_league_picks t
          where t.league_id = v_target.id and t.user_id = v_user and t.market_id = v_pick.market_id
        )
      then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      v_probability := least(0.99, greatest(0.01, public.tregu_outcome_probability(v_market, v_pick.outcome)));
      if v_probability is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if not p_dry_run then
        insert into public.tregu_league_picks (league_id, user_id, market_id, outcome, probability, points)
        values (v_target.id, v_user, v_pick.market_id, v_pick.outcome, v_probability,
                greatest(1, least(99, round(100 * (1 - v_probability))))::int)
        on conflict on constraint tregu_league_picks_pkey do nothing;
      end if;
      v_copied := v_copied + 1;
    end loop;
    league_id := v_target.id;
    league_name := v_target.name;
    copied := v_copied;
    skipped := v_skipped;
    return next;
  end loop;
end;
$$;

revoke all on function public.tregu_league_copy_picks(uuid, boolean) from public, anon;
grant execute on function public.tregu_league_copy_picks(uuid, boolean) to authenticated;
