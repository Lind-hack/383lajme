-- 383 Tregu — trading stops at kickoff, bigger league pots, visible sponsors,
-- and the two player emails (overtaken, prize waiting).
--
-- Run once, in one transaction, like every other migration here.
--
-- Owner's rules, 29 Sep 2026:
--   * A sports market stops trading when its match (live_event.kickoff) or
--     race (live_event.race_start) starts. Whoever holds a position keeps it,
--     and settlement pays it as always. Sport books closed six hours after
--     kickoff before, so people bought and cashed out during play.
--   * Private league bonus from 383 goes up about half: up to a week +15%,
--     two weeks +25%, a month +40% (was 10/15/25).
--   * Public leagues can show their sponsor's logo and link.
--   * Players get an email when someone overtakes them (at most one every six
--     hours, and only if they have not turned league emails off) and when a
--     prize is ready for them to open.

-- ============================================================================
-- Trading stops at kickoff
-- ============================================================================

-- Every trade function (place_*, sell_*) writes positions, so this is the one
-- place a started match can be refused. Only signed-in players are refused:
-- settlement and admin tools run without a player session and must still move
-- positions after the match.
create or replace function public.tregu_refuse_started_trade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live jsonb;
  v_start timestamptz;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select mk.live_event into v_live from public.markets mk where mk.id = coalesce(new.market_id, old.market_id);
  if v_live ? 'kickoff' or v_live ? 'race_start' then
    v_start := public.tregu_market_lock_at(v_live, null);
    if v_start is not null and now() >= v_start then
      raise exception 'Ndeshja ka nisur: tregtimi u mbyll. Pozicioni yt mbetet dhe paguhet sapo të dalë rezultati.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists tregu_refuse_started_trade on public.positions;
create trigger tregu_refuse_started_trade
  before insert or update or delete on public.positions
  for each row execute function public.tregu_refuse_started_trade();

-- ============================================================================
-- Bigger private pots
-- ============================================================================

create or replace function public.tregu_private_bonus_pct(p_starts timestamptz, p_ends timestamptz)
returns int
language sql
immutable
as $$
  select case
    when extract(epoch from (p_ends - p_starts)) <= 7.5 * 86400 then 15
    when extract(epoch from (p_ends - p_starts)) <= 15 * 86400 then 25
    else 40
  end;
$$;

-- ============================================================================
-- Sponsors
-- ============================================================================

alter table public.tregu_leagues
  add column if not exists sponsor_logo text check (sponsor_logo is null or char_length(sponsor_logo) <= 500),
  add column if not exists sponsor_url text check (sponsor_url is null or sponsor_url ~ '^https://[^\s]{3,480}$');

-- The overview and preview gain the sponsor's logo and link. Same bodies as
-- 0087/0086 otherwise.
drop function if exists public.tregu_leagues_overview() cascade;
create function public.tregu_leagues_overview()
returns table (
  id uuid, name text, kind text, code text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, is_creator boolean, my_rank int, my_profit numeric, settled boolean,
  description text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text, faces text[], featured boolean, feature_order int,
  sponsor_logo text, sponsor_url text
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
  ),
  face_rows as (
    select v.id as league_id,
      (array_agg(split_part(coalesce(nullif(trim(p.display_name), ''), 'Tregtar'), ' ', 1) order by m.joined_at desc))[1:5] as faces
    from visible v
    join public.tregu_league_members m on m.league_id = v.id
    join public.profiles p on p.id = m.user_id
    group by v.id
  )
  select
    v.id, v.name, v.kind,
    case when mi.league_id is not null then v.code end,
    v.starts_at, v.ends_at, v.entry_fee, v.prizes,
    coalesce(c.pot, 0), coalesce(c.n, 0), v.max_members,
    mi.league_id is not null,
    coalesce(v.creator_id = auth.uid(), false),
    mi.place, round(mi.net, 0),
    v.settled_at is not null,
    v.description, v.emblem, v.color, v.cover_url, v.sponsor, v.scope_kind, v.scope_value,
    coalesce(f.faces, array[]::text[]),
    v.featured, v.feature_order,
    v.sponsor_logo, v.sponsor_url
  from visible v
  left join counts c on c.league_id = v.id
  left join mine mi on mi.league_id = v.id
  left join face_rows f on f.league_id = v.id
  order by (v.ends_at < now()), v.ends_at asc;
$$;

grant execute on function public.tregu_leagues_overview() to anon, authenticated;

-- tregu_my_league_stats read the overview and was dropped with it above.
create or replace function public.tregu_my_league_stats()
returns table (active int, best_rank int, podiums int, winnings numeric, streak int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.tregu_league_members m join public.tregu_leagues l on l.id = m.league_id
      where m.user_id = auth.uid() and l.ends_at > now() and l.settled_at is null),
    (select min(o.my_rank) from public.tregu_leagues_overview() o where o.is_member and not o.settled and o.ends_at > now()),
    (select count(*)::int from public.tregu_leaderboard_rewards r where r.user_id = auth.uid() and r.league_id is not null and r.status in ('approved', 'claimed')),
    coalesce((select sum(t.amount) from public.transactions t where t.user_id = auth.uid() and t.type = 'league_reward'), 0),
    public.tregu_trading_streak(auth.uid())
  where auth.uid() is not null;
$$;

grant execute on function public.tregu_my_league_stats() to authenticated;

drop function if exists public.tregu_league_preview(text, uuid);
create function public.tregu_league_preview(p_code text default null, p_league_id uuid default null)
returns table (
  id uuid, name text, kind text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, settled boolean,
  description text, rules text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text, sponsor_logo text, sponsor_url text
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
    l.settled_at is not null,
    l.description, l.rules, l.emblem, l.color, l.cover_url, l.sponsor, l.scope_kind, l.scope_value,
    l.sponsor_logo, l.sponsor_url
  from public.tregu_leagues l
  where (p_code is not null and l.code = upper(trim(p_code)))
     or (p_league_id is not null and l.id = p_league_id and (
          l.kind = 'public'
          or exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid())
        ));
$$;

grant execute on function public.tregu_league_preview(text, uuid) to anon, authenticated;

-- ============================================================================
-- Player emails: overtaken, prize waiting
-- ============================================================================

alter table public.tregu_league_events add column if not exists emailed_at timestamptz;
alter table public.tregu_leaderboard_rewards add column if not exists winner_emailed_at timestamptz;

-- Claims what is due and returns one row per email to send. Claiming first
-- means two overlapping heartbeats never mail the same thing twice; a failed
-- send is handed back with tregu_release_player_emails.
create or replace function public.tregu_claim_player_emails(p_limit int default 20)
returns table (
  kind text, user_id uuid, email text, display_name text, unsubscribe_token uuid,
  event_ids uuid[], reward_ids uuid[], payload jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Everyone who can be overtaken has a prefs row, so opt-outs are honoured
  -- and the unsubscribe link in the email resolves.
  insert into public.tregu_notification_prefs (user_id)
  select distinct e.user_id from public.tregu_league_events e
  where e.kind = 'overtaken' and e.emailed_at is null
  on conflict do nothing;

  return query
  with due_users as (
    select e.user_id
    from public.tregu_league_events e
    join public.tregu_notification_prefs np on np.user_id = e.user_id and np.email_digest
    where e.kind = 'overtaken'
      and e.emailed_at is null
      and e.created_at > now() - interval '24 hours'
      and not exists (
        select 1 from public.tregu_league_events x
        where x.user_id = e.user_id and x.kind = 'overtaken' and x.emailed_at > now() - interval '6 hours'
      )
    group by e.user_id
    order by min(e.created_at)
    limit greatest(1, least(p_limit, 100))
  ),
  claimed as (
    update public.tregu_league_events e
    set emailed_at = now()
    from due_users d
    where e.user_id = d.user_id and e.kind = 'overtaken' and e.emailed_at is null
    returning e.id, e.user_id, e.actor, e.data, e.created_at
  )
  select 'overtaken'::text, c.user_id, u.email::text,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    np.unsubscribe_token,
    array_agg(c.id order by c.created_at), null::uuid[],
    jsonb_agg(jsonb_build_object('actor', c.actor, 'data', c.data) order by c.created_at desc)
  from claimed c
  join auth.users u on u.id = c.user_id
  join public.profiles p on p.id = c.user_id
  join public.tregu_notification_prefs np on np.user_id = c.user_id
  where u.email is not null
  group by c.user_id, u.email, p.display_name, np.unsubscribe_token;

  return query
  with claimed as (
    update public.tregu_leaderboard_rewards r
    set winner_emailed_at = now()
    where r.id in (
      select r2.id from public.tregu_leaderboard_rewards r2
      where r2.status = 'approved' and r2.claimed_at is null and r2.winner_emailed_at is null
      order by r2.approved_at nulls first
      limit greatest(1, least(p_limit, 100))
    )
    returning r.id, r.user_id, r.period_kind, r.place, r.prize, r.league_name, r.period_start, r.period_end
  )
  select 'reward'::text, c.user_id, u.email::text,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    null::uuid,
    null::uuid[], array_agg(c.id),
    jsonb_agg(jsonb_build_object('kind', c.period_kind, 'place', c.place, 'prize', c.prize, 'league', c.league_name, 'start', c.period_start, 'end', c.period_end))
  from claimed c
  join auth.users u on u.id = c.user_id
  join public.profiles p on p.id = c.user_id
  where u.email is not null
  group by c.user_id, u.email, p.display_name;
end;
$$;

revoke all on function public.tregu_claim_player_emails(int) from public, anon, authenticated;
grant execute on function public.tregu_claim_player_emails(int) to service_role;

create or replace function public.tregu_release_player_emails(p_event_ids uuid[], p_reward_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.tregu_league_events set emailed_at = null where id = any(coalesce(p_event_ids, array[]::uuid[]));
  update public.tregu_leaderboard_rewards set winner_emailed_at = null where id = any(coalesce(p_reward_ids, array[]::uuid[]));
$$;

revoke all on function public.tregu_release_player_emails(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.tregu_release_player_emails(uuid[], uuid[]) to service_role;

-- Running public leagues still on the old suggested prizes (75% of the
-- leaderboard prize) move to the new ones; amounts the admin chose stay.
update public.tregu_leagues
set prizes = case when prizes = array[94, 56, 30]::numeric[] then array[125, 75, 40]::numeric[] else array[500, 300, 150]::numeric[] end
where kind = 'public'
  and settled_at is null
  and prizes in (array[94, 56, 30]::numeric[], array[375, 225, 113]::numeric[]);
