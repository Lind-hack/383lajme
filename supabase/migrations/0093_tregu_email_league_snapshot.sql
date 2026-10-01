-- 383 Tregu — what the league emails need to look like a league
--
-- Run once, in one transaction, like every other migration here.
--
-- 1. tregu_claim_player_emails carries each overtake's league_id, so the email
--    can show that league's podium (body otherwise identical to 0090).
-- 2. tregu_email_league_snapshot(league, user): the podium, the rows around the
--    reader, the prize pot and the next three matches with what a favourite and
--    a surprise pay. Service role only: it reads every member's name.

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
    returning e.id, e.user_id, e.league_id, e.actor, e.data, e.created_at
  )
  select 'overtaken'::text, c.user_id, u.email::text,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    np.unsubscribe_token,
    array_agg(c.id order by c.created_at), null::uuid[],
    jsonb_agg(jsonb_build_object('actor', c.actor, 'data', c.data, 'league_id', c.league_id) order by c.created_at desc)
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



create or replace function public.tregu_email_league_snapshot(p_league_id uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select l.* from public.tregu_leagues l where l.id = p_league_id
  ),
  ranked as (
    select s.uid, round(s.net, 0) as pts,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
    from public.tregu_league_scores(p_league_id) s
  ),
  named as (
    select r.place, r.pts, r.uid = p_user as me,
      coalesce(nullif(trim(p.display_name), ''), 'Tregtar') as name
    from ranked r join public.profiles p on p.id = r.uid
  ),
  mine as (select coalesce(max(place) filter (where me), 0) as place from named),
  shown as (
    select n.* from named n, mine
    where n.place <= 3 or n.me or n.place = mine.place - 1 or n.place = mine.place + 1
  ),
  upcoming as (
    select mk as mrow, mk.slug, mk.question, mk.outcomes, mk.sport_outcomes,
      public.tregu_market_lock_at(mk.live_event, mk.closes_at) as lock_at
    from public.markets mk, lg
    where mk.status = 'open'
      and public.tregu_league_scope_match(lg.scope_kind, lg.scope_value, mk.id)
  ),
  matches as (
    select u.slug, u.question, u.lock_at,
      (select jsonb_agg(jsonb_build_object(
          'label', coalesce((select so->>'label' from jsonb_array_elements(coalesce(u.sport_outcomes, '[]'::jsonb)) so where so->>'key' = o), o),
          'points', greatest(1, least(99, round(100 * (1 - least(0.99, greatest(0.01, public.tregu_outcome_probability(u.mrow, o)))))))::int
        ) order by public.tregu_outcome_probability(u.mrow, o) desc)
       from unnest(u.outcomes) o) as options
    from upcoming u, lg
    where u.lock_at > now() and u.lock_at <= lg.ends_at
    order by u.lock_at
    limit 3
  )
  select jsonb_build_object(
    'name', lg.name, 'kind', lg.kind, 'emblem', lg.emblem, 'color', lg.color,
    'prizes', lg.prizes, 'starts_at', lg.starts_at, 'ends_at', lg.ends_at,
    'members', (select count(*) from public.tregu_league_members m where m.league_id = lg.id),
    'pot', (select coalesce(sum(m.fee_paid), 0) from public.tregu_league_members m where m.league_id = lg.id),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', s.place, 'name', s.name, 'points', s.pts, 'me', s.me) order by s.place) from shown s), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('slug', m.slug, 'question', m.question, 'lock_at', m.lock_at, 'options', m.options) order by m.lock_at) from matches m), '[]'::jsonb)
  )
  from lg;
$$;

revoke all on function public.tregu_email_league_snapshot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.tregu_email_league_snapshot(uuid, uuid) to service_role;
