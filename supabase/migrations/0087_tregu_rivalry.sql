-- 383 Tregu — rivalry: create-with-look, 1v1 duels, overtake events, alerts
--
-- Run once, in one transaction, like every other migration here.
--
-- 1. Private leagues get their look on creation (emoji or uploaded photo,
--    and a colour), chosen on the create sheet with the name and fee.
-- 2. Public leagues can be featured on the Tregu home card, in an order the
--    admin sets.
-- 3. Duels: any two members of a league can challenge each other to 24 hours
--    of trading. Each puts in 0..50 coins; whoever closes more profit in the
--    24 hours takes both stakes. A tie, a decline or an unanswered challenge
--    (24h) returns the stakes.
-- 4. Rank events: a periodic job snapshots every active league's ranks and
--    records "X overtook you" / "you climbed" events. They feed the
--    since-your-last-visit banner, browser push and the daily email.
-- 5. Push subscriptions, email preferences and the VAPID key live in tables
--    only the service role can read.

-- ============================================================================
-- League look + featuring
-- ============================================================================

alter table public.tregu_leagues
  add column if not exists featured boolean not null default false,
  add column if not exists feature_order int not null default 0;

-- A private league's emblem is an emoji (a few characters) or a photo in our
-- own league-media bucket; nothing else is accepted from a client.
create or replace function public.tregu_valid_client_emblem(p_emblem text)
returns boolean
language sql
immutable
as $$
  select p_emblem is null
      or char_length(p_emblem) <= 16
      or p_emblem ~ '^https://[a-z0-9.-]+/storage/v1/object/public/league-media/user/[0-9a-f-]+/[0-9a-f-]+\.(png|jpg|webp)$';
$$;

drop function if exists public.tregu_league_create(text, int, numeric);
create function public.tregu_league_create(
  p_name text,
  p_days int,
  p_entry_fee numeric,
  p_emblem text default null,
  p_color text default null
)
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
  v_fee numeric := round(coalesce(p_entry_fee, 10));
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'Emri i ligës duhet të ketë 3 deri në 40 shkronja.';
  end if;
  if p_days not in (1, 3, 7, 14, 30) then raise exception 'Kohëzgjatja nuk vlen.'; end if;
  if v_fee < 10 or v_fee > 10000 then raise exception 'Tarifa duhet të jetë 10 deri në 10 000 monedha.'; end if;
  if not public.tregu_valid_client_emblem(nullif(trim(p_emblem), '')) then raise exception 'Ikona nuk vlen.'; end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Ngjyra nuk vlen.'; end if;
  if (select count(*) from public.tregu_leagues l
      where l.creator_id = v_user and l.kind = 'private' and l.ends_at > now()) >= 3 then
    raise exception 'Mund të kesh deri në 3 liga aktive njëherësh.';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.tregu_leagues l where l.code = v_code);
  end loop;

  insert into public.tregu_leagues (name, kind, code, creator_id, starts_at, ends_at, entry_fee, emblem, color)
  values (trim(p_name), 'private', v_code, v_user, now(), now() + make_interval(days => p_days), v_fee,
          nullif(trim(p_emblem), ''), p_color)
  returning tregu_leagues.id into v_id;

  select j.balance into v_balance from public.tregu_league_join(v_id, null) j;
  return query select v_id, v_code, v_balance;
end;
$$;

revoke all on function public.tregu_league_create(text, int, numeric, text, text) from public, anon;
grant execute on function public.tregu_league_create(text, int, numeric, text, text) to authenticated;

-- The overview gains the featuring columns.
drop function if exists public.tregu_leagues_overview();
create function public.tregu_leagues_overview()
returns table (
  id uuid, name text, kind text, code text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, is_creator boolean, my_rank int, my_profit numeric, settled boolean,
  description text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text, faces text[], featured boolean, feature_order int
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
    v.featured, v.feature_order
  from visible v
  left join counts c on c.league_id = v.id
  left join mine mi on mi.league_id = v.id
  left join face_rows f on f.league_id = v.id
  order by (v.ends_at < now()), v.ends_at asc;
$$;

grant execute on function public.tregu_leagues_overview() to anon, authenticated;

-- tregu_my_league_stats read the overview; recreate so it binds to the new one.
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

-- ============================================================================
-- Standings carry an opaque member key (challenge target) and duel record
-- ============================================================================

-- A member's key: stable per league, reveals nothing about the account.
create or replace function public.tregu_member_key(p_league uuid, p_user uuid)
returns text
language sql
immutable
as $$
  select substr(md5(p_league::text || ':' || p_user::text || ':383-duel'), 1, 16);
$$;

-- ============================================================================
-- Rank snapshots + events
-- ============================================================================

create table if not exists public.tregu_league_ranks (
  league_id uuid not null references public.tregu_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank int not null,
  profit numeric not null,
  -- The rank at the start of the Kosovo day, for the table's ↑/↓ marks.
  day_rank int not null,
  day date not null,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
alter table public.tregu_league_ranks enable row level security;

create table if not exists public.tregu_league_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid references public.tregu_leagues(id) on delete cascade,
  kind text not null check (kind in ('overtaken', 'climbed', 'duel_challenge', 'duel_accepted', 'duel_declined', 'duel_won', 'duel_lost', 'duel_draw', 'duel_expired')),
  actor text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  pushed_at timestamptz,
  emailed_at timestamptz
);
alter table public.tregu_league_events enable row level security;
create index if not exists tregu_league_events_user_idx on public.tregu_league_events (user_id, created_at desc);
create index if not exists tregu_league_events_push_idx on public.tregu_league_events (created_at) where pushed_at is null;

-- Recomputes every active league's ranks and records who passed whom since
-- the last snapshot. Service role only (the heartbeat).
create or replace function public.tregu_refresh_league_ranks()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league record;
  v_row record;
  v_prev record;
  v_passer record;
  v_events int := 0;
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
begin
  for v_league in
    select l.id, l.name from public.tregu_leagues l
    where l.settled_at is null and l.starts_at <= now() and l.ends_at > now()
  loop
    create temporary table if not exists tmp_ranks (uid uuid, place int, net numeric) on commit drop;
    create temporary table if not exists tmp_prev (uid uuid, rank int) on commit drop;
    delete from tmp_ranks;
    delete from tmp_prev;
    insert into tmp_prev select r.user_id, r.rank from public.tregu_league_ranks r where r.league_id = v_league.id;
    insert into tmp_ranks
    select s.uid,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int,
      s.net
    from public.tregu_league_scores(v_league.id) s;

    for v_row in select * from tmp_ranks loop
      select * into v_prev from tmp_prev t where t.uid = v_row.uid;
      if found and v_row.place > v_prev.rank then
        -- Who is now directly above, having been at or below us before?
        select t.uid, coalesce(nullif(trim(p.display_name), ''), 'Tregtar') as name, t.net into v_passer
        from tmp_ranks t
        join public.profiles p on p.id = t.uid
        left join tmp_prev pr on pr.uid = t.uid
        where t.place < v_row.place and coalesce(pr.rank, 999999) >= v_prev.rank
        order by t.place desc
        limit 1;
        if found then
          insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
          values (v_row.uid, v_league.id, 'overtaken', split_part(v_passer.name, ' ', 1), jsonb_build_object(
            'league', v_league.name, 'from', v_prev.rank, 'to', v_row.place,
            'gap', round(greatest(v_passer.net - v_row.net, 0)) + 1));
          v_events := v_events + 1;
        end if;
      elsif found and v_row.place < v_prev.rank then
        insert into public.tregu_league_events (user_id, league_id, kind, data)
        values (v_row.uid, v_league.id, 'climbed', jsonb_build_object('league', v_league.name, 'from', v_prev.rank, 'to', v_row.place));
        v_events := v_events + 1;
      end if;

      insert into public.tregu_league_ranks (league_id, user_id, rank, profit, day_rank, day, updated_at)
      values (v_league.id, v_row.uid, v_row.place, v_row.net, v_row.place, v_today, now())
      on conflict (league_id, user_id) do update set
        rank = excluded.rank,
        profit = excluded.profit,
        day_rank = case when tregu_league_ranks.day = v_today then tregu_league_ranks.day_rank else tregu_league_ranks.rank end,
        day = v_today,
        updated_at = now();
    end loop;
  end loop;
  return v_events;
end;
$$;

revoke all on function public.tregu_refresh_league_ranks() from public, anon, authenticated;
grant execute on function public.tregu_refresh_league_ranks() to service_role;

-- The caller's recent events (unseen first), and marking them seen.
create or replace function public.tregu_my_league_events(p_limit int default 20)
returns table (id uuid, league_id uuid, kind text, actor text, data jsonb, created_at timestamptz, seen boolean)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.league_id, e.kind, e.actor, e.data, e.created_at, e.seen_at is not null
  from public.tregu_league_events e
  where e.user_id = auth.uid() and e.created_at > now() - interval '7 days'
  order by (e.seen_at is not null), e.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.tregu_mark_league_events_seen()
returns int
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.tregu_league_events set seen_at = now()
    where user_id = auth.uid() and seen_at is null
    returning 1
  )
  select count(*)::int from done;
$$;

grant execute on function public.tregu_my_league_events(int) to authenticated;
grant execute on function public.tregu_mark_league_events_seen() to authenticated;

-- ============================================================================
-- Duels
-- ============================================================================

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('signup_bonus', 'daily_bonus', 'bet', 'payout', 'withdrawal', 'sell',
                  'leaderboard_reward', 'league_fee', 'league_reward',
                  'duel_stake', 'duel_win', 'duel_refund'));

create table if not exists public.tregu_duels (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.tregu_leagues(id) on delete cascade,
  challenger uuid not null references auth.users(id) on delete cascade,
  opponent uuid not null references auth.users(id) on delete cascade,
  stake numeric not null check (stake >= 0 and stake <= 50),
  status text not null default 'pending' check (status in ('pending', 'active', 'settled', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ends_at timestamptz,
  winner uuid references auth.users(id),
  challenger_net numeric,
  opponent_net numeric,
  settled_at timestamptz,
  check (challenger <> opponent)
);
alter table public.tregu_duels enable row level security;
create index if not exists tregu_duels_open_idx on public.tregu_duels (status, ends_at);
-- One open duel per pair per league at a time.
create unique index if not exists tregu_duels_pair_open
  on public.tregu_duels (league_id, least(challenger, opponent), greatest(challenger, opponent))
  where status in ('pending', 'active');

create or replace function public.tregu_duel_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(coalesce(nullif(trim(p.display_name), ''), 'Tregtar'), ' ', 1) from public.profiles p where p.id = p_user;
$$;
revoke all on function public.tregu_duel_name(uuid) from public, anon, authenticated;

create or replace function public.tregu_duel_challenge(p_league_id uuid, p_member_key text, p_stake numeric)
returns table (duel_id uuid, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_opponent uuid;
  v_stake numeric := round(coalesce(p_stake, 0));
  v_balance numeric;
  v_id uuid;
  v_league public.tregu_leagues%rowtype;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  if v_stake < 0 or v_stake > 50 then raise exception 'Basti i duelit është 0 deri në 50 monedha.'; end if;
  select * into v_league from public.tregu_leagues where id = p_league_id;
  if not found or v_league.ends_at <= now() then raise exception 'Liga nuk është aktive.'; end if;
  if not exists (select 1 from public.tregu_league_members m where m.league_id = p_league_id and m.user_id = v_user) then
    raise exception 'Duhet të jesh në ligë për të sfiduar.';
  end if;
  select m.user_id into v_opponent from public.tregu_league_members m
  where m.league_id = p_league_id and public.tregu_member_key(p_league_id, m.user_id) = p_member_key;
  if v_opponent is null then raise exception 'Kundërshtari nuk u gjet.'; end if;
  if v_opponent = v_user then raise exception 'Nuk mund të sfidosh veten.'; end if;
  if exists (select 1 from public.tregu_duels d where d.league_id = p_league_id
             and least(d.challenger, d.opponent) = least(v_user, v_opponent)
             and greatest(d.challenger, d.opponent) = greatest(v_user, v_opponent)
             and d.status in ('pending', 'active')) then
    raise exception 'Keni tashmë një duel të hapur.';
  end if;

  if v_stake > 0 then
    update public.profiles set coins = coins - v_stake where id = v_user and coins >= v_stake returning coins into v_balance;
    if not found then raise exception 'Nuk ke mjaft monedha për bastin.'; end if;
  else
    select coins into v_balance from public.profiles where id = v_user;
  end if;

  insert into public.tregu_duels (league_id, challenger, opponent, stake)
  values (p_league_id, v_user, v_opponent, v_stake)
  returning id into v_id;

  if v_stake > 0 then
    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'duel_stake', -v_stake, jsonb_build_object('duel_id', v_id,
      'note', format('Bast dueli me %s', public.tregu_duel_name(v_opponent))));
  end if;

  insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
  values (v_opponent, p_league_id, 'duel_challenge', public.tregu_duel_name(v_user),
    jsonb_build_object('duel_id', v_id, 'stake', v_stake, 'league', v_league.name));

  return query select v_id, v_balance;
end;
$$;

create or replace function public.tregu_duel_respond(p_duel_id uuid, p_accept boolean)
returns table (status text, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_duel public.tregu_duels%rowtype;
  v_balance numeric;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  select * into v_duel from public.tregu_duels d where d.id = p_duel_id and d.opponent = v_user and d.status = 'pending' for update;
  if not found then raise exception 'Sfida nuk është më e hapur.'; end if;

  if not p_accept then
    update public.tregu_duels set status = 'declined', settled_at = now() where id = v_duel.id;
    if v_duel.stake > 0 then
      update public.profiles set coins = coins + v_duel.stake where id = v_duel.challenger;
      insert into public.transactions (user_id, type, amount, meta)
      values (v_duel.challenger, 'duel_refund', v_duel.stake, jsonb_build_object('duel_id', v_duel.id, 'note', 'Sfida u refuzua'));
    end if;
    insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
    values (v_duel.challenger, v_duel.league_id, 'duel_declined', public.tregu_duel_name(v_user), jsonb_build_object('duel_id', v_duel.id));
    select coins into v_balance from public.profiles where id = v_user;
    return query select 'declined'::text, v_balance;
    return;
  end if;

  if v_duel.stake > 0 then
    update public.profiles set coins = coins - v_duel.stake where id = v_user and coins >= v_duel.stake returning coins into v_balance;
    if not found then raise exception 'Nuk ke mjaft monedha për bastin.'; end if;
    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'duel_stake', -v_duel.stake, jsonb_build_object('duel_id', v_duel.id,
      'note', format('Bast dueli me %s', public.tregu_duel_name(v_duel.challenger))));
  else
    select coins into v_balance from public.profiles where id = v_user;
  end if;

  update public.tregu_duels set status = 'active', accepted_at = now(), ends_at = now() + interval '24 hours' where id = v_duel.id;
  insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
  values (v_duel.challenger, v_duel.league_id, 'duel_accepted', public.tregu_duel_name(v_user), jsonb_build_object('duel_id', v_duel.id));
  return query select 'active'::text, v_balance;
end;
$$;

revoke all on function public.tregu_duel_challenge(uuid, text, numeric) from public, anon;
revoke all on function public.tregu_duel_respond(uuid, boolean) from public, anon;
grant execute on function public.tregu_duel_challenge(uuid, text, numeric) to authenticated;
grant execute on function public.tregu_duel_respond(uuid, boolean) to authenticated;

-- Profit a user closed in a window, over every market.
create or replace function public.tregu_closed_between(p_user uuid, p_from timestamptz, p_to timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(c.pnl), 0) from public.tregu_closed_trades() c
  where c.uid = p_user and c.closed_at >= p_from and c.closed_at < p_to;
$$;
revoke all on function public.tregu_closed_between(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- The caller's duels: open ones with live scores, then the last week's results.
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
    round(case
      when d.status = 'active' then public.tregu_closed_between(auth.uid(), d.accepted_at, d.ends_at)
      when d.challenger = auth.uid() then d.challenger_net else d.opponent_net end, 0),
    round(case
      when d.status = 'active' then public.tregu_closed_between(case when d.challenger = auth.uid() then d.opponent else d.challenger end, d.accepted_at, d.ends_at)
      when d.challenger = auth.uid() then d.opponent_net else d.challenger_net end, 0),
    case when d.status = 'settled' then d.winner = auth.uid() end
  from public.tregu_duels d
  join public.tregu_leagues l on l.id = d.league_id
  where (d.challenger = auth.uid() or d.opponent = auth.uid())
    and (d.status in ('pending', 'active') or d.settled_at > now() - interval '7 days')
  order by (d.status not in ('pending', 'active')), d.created_at desc
  limit 20;
$$;
grant execute on function public.tregu_my_duels() to authenticated;

-- Heartbeat: expire unanswered challenges, settle finished duels.
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
    v_c := public.tregu_closed_between(v_duel.challenger, v_duel.accepted_at, v_duel.ends_at);
    v_o := public.tregu_closed_between(v_duel.opponent, v_duel.accepted_at, v_duel.ends_at);
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
-- Standings (after the tables they read)
-- ============================================================================

drop function if exists public.tregu_league_standings(uuid);
create function public.tregu_league_standings(p_league_id uuid)
returns table (
  rank int, display_name text, profit numeric, is_me boolean, is_creator boolean,
  today_profit numeric, trades int, streak int, joined_at timestamptz,
  member_key text, rank_change int, duel_wins int
)
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
    coalesce(r.uid = l.creator_id, false),
    round(r.today_net, 0),
    r.trades,
    public.tregu_trading_streak(r.uid),
    r.joined_at,
    public.tregu_member_key(l.id, r.uid),
    -- Positive: places gained since the last snapshot before today.
    coalesce(prev.day_rank - r.place, 0),
    (select count(*)::int from public.tregu_duels d where d.league_id = l.id and d.winner = r.uid)
  from public.tregu_leagues l
  cross join lateral (
    select s.*,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
    from public.tregu_league_scores(l.id) s
  ) r
  join public.profiles p on p.id = r.uid
  left join public.tregu_league_ranks prev on prev.league_id = l.id and prev.user_id = r.uid
  where l.id = p_league_id
    and (l.kind = 'public' or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  order by r.place;
$$;

grant execute on function public.tregu_league_standings(uuid) to anon, authenticated;

-- ============================================================================
-- Race chart: each member's closed profit, day by day
-- ============================================================================

create or replace function public.tregu_league_race(p_league_id uuid)
returns table (display_name text, is_me boolean, day date, cumulative numeric)
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
  days as (
    select generate_series(
      (lg.starts_at at time zone 'Europe/Belgrade')::date,
      least((now() at time zone 'Europe/Belgrade')::date, ((lg.ends_at - interval '1 second') at time zone 'Europe/Belgrade')::date),
      interval '1 day')::date as d
    from lg
  ),
  -- Top eight by current profit, plus the caller.
  who as (
    select s.uid from lg, public.tregu_league_scores(lg.id) s
    order by (s.uid = auth.uid()) desc, s.net desc limit 9
  ),
  closes as (
    select c.uid, (c.closed_at at time zone 'Europe/Belgrade')::date as d, sum(c.pnl) as pnl
    from lg
    join public.tregu_league_members m on m.league_id = lg.id and m.user_id in (select uid from who)
    join public.tregu_closed_trades() c on c.uid = m.user_id
    where c.closed_at >= greatest(lg.starts_at, m.joined_at) and c.closed_at < lg.ends_at
      and public.tregu_league_scope_match(lg.scope_kind, lg.scope_value, c.mid)
    group by 1, 2
  )
  select
    split_part(coalesce(nullif(trim(p.display_name), ''), 'Tregtar'), ' ', 1),
    w.uid = auth.uid(),
    days.d,
    round(coalesce(sum(cl.pnl) over (partition by w.uid order by days.d), 0), 0)
  from who w
  cross join days
  join public.profiles p on p.id = w.uid
  left join closes cl on cl.uid = w.uid and cl.d = days.d
  order by w.uid, days.d;
$$;
grant execute on function public.tregu_league_race(uuid) to anon, authenticated;

-- ============================================================================
-- Push subscriptions, email preferences, secrets
-- ============================================================================

create table if not exists public.tregu_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tregu_push_subscriptions enable row level security;

create or replace function public.tregu_save_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Duhet të hysh në llogari.'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'Abonimi nuk vlen.'; end if;
  insert into public.tregu_push_subscriptions (endpoint, user_id) values (p_endpoint, auth.uid())
  on conflict (endpoint) do update set user_id = excluded.user_id, created_at = now();
  return true;
end;
$$;
grant execute on function public.tregu_save_push_subscription(text) to authenticated;

create table if not exists public.tregu_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_digest boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_digest_on date
);
alter table public.tregu_notification_prefs enable row level security;

-- Digest recipients: members of an active league who have not opted out and
-- have not had today's email. Service role only (it returns email addresses).
create or replace function public.tregu_digest_recipients(p_limit int default 40)
returns table (user_id uuid, email text, display_name text, unsubscribe_token uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Every member of an active league gets a prefs row, so the token in the
  -- email's unsubscribe link exists when it is clicked.
  insert into public.tregu_notification_prefs (user_id)
  select distinct m.user_id
  from public.tregu_league_members m
  join public.tregu_leagues l on l.id = m.league_id and l.settled_at is null and l.ends_at > now()
  on conflict do nothing;

  return query
  select u.id, u.email::text,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
    np.unsubscribe_token
  from public.tregu_notification_prefs np
  join auth.users u on u.id = np.user_id
  join public.profiles p on p.id = u.id
  where u.email is not null
    and np.email_digest
    and (np.last_digest_on is null or np.last_digest_on < (now() at time zone 'Europe/Belgrade')::date)
    and exists (
      select 1 from public.tregu_league_members m
      join public.tregu_leagues l on l.id = m.league_id and l.settled_at is null and l.ends_at > now()
      where m.user_id = u.id
    )
  order by u.id
  limit greatest(1, least(p_limit, 200));
end;
$$;
revoke all on function public.tregu_digest_recipients(int) from public, anon, authenticated;
grant execute on function public.tregu_digest_recipients(int) to service_role;

-- Unsubscribe by token (from the email link; no login).
create or replace function public.tregu_digest_unsubscribe(p_token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with done as (
    update public.tregu_notification_prefs set email_digest = false where unsubscribe_token = p_token returning 1
  )
  select exists (select 1 from done);
$$;
grant execute on function public.tregu_digest_unsubscribe(uuid) to anon, authenticated;

create table if not exists public.tregu_app_secrets (
  key text primary key,
  value text not null
);
alter table public.tregu_app_secrets enable row level security;
