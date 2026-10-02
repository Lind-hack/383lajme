-- 383 Tregu — Ligat for everyone: public leagues by readers, leaving, the hub
--
-- Run once, in one transaction, like every other migration here.
-- Plan: docs/plans/2026-10-03-leagues/PLAN.md (owner's rules, 3 Oct 2026).
--
-- 1. A reader can open ONE public league at a time (`listed`). It keeps the
--    private economy end to end — entry pot + 383's time bonus, 50/30/20,
--    paid straight away — but anyone can find it, search it and join it with
--    one tap, no code. Its emblem is one of the built-in emojis, never a photo.
--    383's own leagues stay `kind = 'public'` ("Zyrtare").
-- 2. Leaving: any member, any time before the league ends. The fee comes back
--    before the start, or within 15 minutes of joining with no pick made;
--    otherwise it stays in the pot (`forfeited`). Picks and ranks go, duels in
--    that league are called off with their stakes returned. The last member
--    out closes the league.
-- 3. One pot definition, tregu_league_pot(): members' fees plus what leavers
--    left behind. Every pot reader uses it.
-- 4. tregu_leagues_hub(): everything the floor's league cards show, in one call
--    — the podium, your rank and its change today, the gap to third, today's
--    open picks, today's top scorer — plus 383's leagues and the five busiest
--    public ones. tregu_league_search() finds the rest.
-- 5. A "picks_due" league event, at most one per reader per Kosovo day, queued
--    two hours before their first unpicked match locks; the existing push sends
--    it.

-- ============================================================================
-- Columns, the emoji list, the audit trail
-- ============================================================================

alter table public.tregu_leagues
  add column if not exists listed boolean not null default false,
  add column if not exists forfeited numeric not null default 0 check (forfeited >= 0),
  add column if not exists unlisted_at timestamptz;

-- The create sheet's icons (LEAGUE_EMOJIS in lib/tregu-leagues.ts — a test
-- keeps the two lists equal). A public league may only wear one of these.
create or replace function public.tregu_listed_emblems()
returns text[]
language sql
immutable
as $$
  select array['🏆', '🦅', '🔥', '⚡', '👑', '🎯', '🚀', '💎', '🐺', '⚽', '🏀', '🏎️']::text[];
$$;

alter table public.tregu_leagues drop constraint if exists tregu_leagues_listed_emblem_check;
alter table public.tregu_leagues add constraint tregu_leagues_listed_emblem_check
  check (not listed or emblem is null or emblem = any (public.tregu_listed_emblems()));

-- Only readers' leagues are listed; 383's are public already.
alter table public.tregu_leagues drop constraint if exists tregu_leagues_listed_kind_check;
alter table public.tregu_leagues add constraint tregu_leagues_listed_kind_check
  check (not listed or kind = 'private');

create index if not exists tregu_leagues_listed_idx on public.tregu_leagues (ends_at) where listed and settled_at is null;
create index if not exists tregu_leagues_creator_idx on public.tregu_leagues (creator_id, ends_at);
create index if not exists tregu_league_picks_user_idx on public.tregu_league_picks (user_id, league_id);

-- What happened to leagues that no longer exist. No foreign key on purpose:
-- the row has to outlive the league it describes. Service role only.
create table if not exists public.tregu_league_audit (
  id bigint generated always as identity primary key,
  league_id uuid not null,
  name text not null,
  action text not null check (action in ('deleted_last_member', 'unlisted')),
  forfeited numeric not null default 0,
  actor uuid,
  at timestamptz not null default now()
);
alter table public.tregu_league_audit enable row level security;

-- ============================================================================
-- The pot
-- ============================================================================

create or replace function public.tregu_league_pot(p_league_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sum(m.fee_paid) from public.tregu_league_members m where m.league_id = p_league_id), 0)
       + coalesce((select l.forfeited from public.tregu_leagues l where l.id = p_league_id), 0);
$$;
revoke all on function public.tregu_league_pot(uuid) from public, anon, authenticated;

-- ============================================================================
-- Create: public or private, one public league at a time
-- ============================================================================

drop function if exists public.tregu_league_create(text, int, numeric, text, text);
create function public.tregu_league_create(
  p_name text,
  p_days int,
  p_entry_fee numeric,
  p_emblem text default null,
  p_color text default null,
  p_listed boolean default false
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
  v_listed boolean := coalesce(p_listed, false);
  v_emblem text := nullif(trim(p_emblem), '');
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_existing record;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'Emri i ligës duhet të ketë 3 deri në 40 shkronja.';
  end if;
  if p_days not in (1, 3, 7, 14, 30) then raise exception 'Kohëzgjatja nuk vlen.'; end if;
  if v_fee < 10 or v_fee > 10000 then raise exception 'Tarifa duhet të jetë 10 deri në 10 000 monedha.'; end if;
  if not public.tregu_valid_client_emblem(v_emblem) then raise exception 'Ikona nuk vlen.'; end if;
  if v_listed and v_emblem is not null and not (v_emblem = any (public.tregu_listed_emblems())) then
    raise exception 'Ligat publike përdorin vetëm ikonat e gatshme.';
  end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Ngjyra nuk vlen.'; end if;

  -- Two taps at once must not both pass the limit below.
  perform pg_advisory_xact_lock(hashtext('tregu_league_create:' || v_user::text));

  if v_listed then
    select l.name, l.ends_at into v_existing
    from public.tregu_leagues l
    where l.creator_id = v_user and l.listed and l.ends_at > now()
    order by l.ends_at
    limit 1;
    if found then
      raise exception 'Ke tashmë një ligë publike: "%". Krijo tjetrën kur të mbarojë.', v_existing.name;
    end if;
  elsif (select count(*) from public.tregu_leagues l
         where l.creator_id = v_user and l.kind = 'private' and not l.listed and l.ends_at > now()) >= 3 then
    raise exception 'Mund të kesh deri në 3 liga private aktive njëherësh.';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.tregu_leagues l where l.code = v_code);
  end loop;

  insert into public.tregu_leagues (name, kind, code, creator_id, starts_at, ends_at, entry_fee, emblem, color, listed)
  values (trim(p_name), 'private', v_code, v_user, now(), now() + make_interval(days => p_days), v_fee,
          v_emblem, p_color, v_listed)
  returning tregu_leagues.id into v_id;

  select j.balance into v_balance from public.tregu_league_join(v_id, null) j;
  return query select v_id, v_code, v_balance;
end;
$$;
revoke all on function public.tregu_league_create(text, int, numeric, text, text, boolean) from public, anon;
grant execute on function public.tregu_league_create(text, int, numeric, text, text, boolean) to authenticated;

-- ============================================================================
-- Join: public leagues by id, listed ones too
-- ============================================================================

create or replace function public.tregu_league_join(p_league_id uuid default null, p_code text default null)
returns table (league_id uuid, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_balance numeric;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;

  if p_code is not null then
    select * into v_league from public.tregu_leagues l where l.code = upper(trim(p_code)) for update;
  else
    select * into v_league from public.tregu_leagues l where l.id = p_league_id for update;
    -- An unlisted private league is only reachable by its code (its creator
    -- joins by id from tregu_league_create, where the caller is the creator).
    if found and v_league.kind = 'private' and not v_league.listed and v_league.creator_id is distinct from v_user then
      raise exception 'Kjo ligë është private: hyr me kodin e saj.';
    end if;
  end if;
  if not found then raise exception 'Liga nuk u gjet. Kontrollo kodin.'; end if;

  if v_league.ends_at <= now() or v_league.settled_at is not null then
    raise exception 'Kjo ligë ka përfunduar.';
  end if;
  if exists (select 1 from public.tregu_league_members m where m.league_id = v_league.id and m.user_id = v_user) then
    raise exception 'Je tashmë anëtar i kësaj lige.';
  end if;
  if (select count(*) from public.tregu_league_members m where m.league_id = v_league.id) >= v_league.max_members then
    raise exception 'Liga është plot.';
  end if;

  if v_league.entry_fee > 0 then
    update public.profiles set coins = coins - v_league.entry_fee
    where id = v_user and coins >= v_league.entry_fee
    returning coins into v_balance;
    if not found then raise exception 'Nuk ke mjaft monedha për tarifën e hyrjes.'; end if;

    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'league_fee', -v_league.entry_fee, jsonb_build_object(
      'league_id', v_league.id,
      'note', format('Hyrje në ligën "%s"', v_league.name)
    ));
  else
    select coins into v_balance from public.profiles where id = v_user;
  end if;

  insert into public.tregu_league_members (league_id, user_id, fee_paid)
  values (v_league.id, v_user, v_league.entry_fee);

  return query select v_league.id, v_balance;
end;
$$;
revoke all on function public.tregu_league_join(uuid, text) from public, anon;
grant execute on function public.tregu_league_join(uuid, text) to authenticated;

-- ============================================================================
-- Leave
-- ============================================================================

create or replace function public.tregu_league_leave(p_league_id uuid)
returns table (balance numeric, refunded numeric, deleted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_member public.tregu_league_members%rowtype;
  v_members int;
  v_refund numeric := 0;
  v_deleted boolean := false;
  v_balance numeric;
  v_duel record;
  v_rival uuid;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;

  select * into v_league from public.tregu_leagues l where l.id = p_league_id for update;
  if not found then raise exception 'Liga nuk u gjet.'; end if;
  select * into v_member from public.tregu_league_members m
  where m.league_id = p_league_id and m.user_id = v_user for update;
  if not found then raise exception 'Nuk je anëtar i kësaj lige.'; end if;
  if v_league.settled_at is not null or v_league.ends_at <= now() then
    raise exception 'Kjo ligë ka përfunduar.';
  end if;

  select count(*)::int into v_members from public.tregu_league_members m where m.league_id = p_league_id;

  -- The fee comes back before the start, inside the 15-minute grace with no
  -- pick made, or when nobody else is left to win it.
  if v_league.starts_at > now()
     or v_members = 1
     or (v_member.joined_at > now() - interval '15 minutes'
         and not exists (select 1 from public.tregu_league_picks p where p.league_id = p_league_id and p.user_id = v_user)) then
    v_refund := coalesce(v_member.fee_paid, 0);
  end if;

  -- Duels in this league are called off. Only rows this statement moves out of
  -- pending/active are refunded, so a duel that settle or respond already moved
  -- is left alone. Pending: only the challenger has paid. Active: both have.
  for v_duel in
    with locked as (
      select d.id, d.status as was
      from public.tregu_duels d
      where d.league_id = p_league_id
        and (d.challenger = v_user or d.opponent = v_user)
        and d.status in ('pending', 'active')
      for update
    )
    update public.tregu_duels d
    set status = 'expired', settled_at = now()
    from locked
    where d.id = locked.id and d.status in ('pending', 'active')
    returning d.id, locked.was, d.challenger, d.opponent, d.stake
  loop
    v_rival := case when v_duel.challenger = v_user then v_duel.opponent else v_duel.challenger end;
    if v_duel.stake > 0 then
      update public.profiles set coins = coins + v_duel.stake
      where id = v_duel.challenger or (v_duel.was = 'active' and id = v_duel.opponent);
      insert into public.transactions (user_id, type, amount, meta)
      select u, 'duel_refund', v_duel.stake, jsonb_build_object('duel_id', v_duel.id, 'note', 'Dueli u anulua: dikush doli nga liga')
      from unnest(case when v_duel.was = 'active' then array[v_duel.challenger, v_duel.opponent] else array[v_duel.challenger] end) u;
    end if;
    insert into public.tregu_league_events (user_id, league_id, kind, actor, data)
    values (v_rival, p_league_id, 'duel_expired', public.tregu_duel_name(v_user),
      jsonb_build_object('duel_id', v_duel.id, 'reason', 'left', 'league', v_league.name,
        'refunded', v_duel.stake > 0 and (v_duel.was = 'active' or v_rival = v_duel.challenger)));
  end loop;

  delete from public.tregu_league_picks p where p.league_id = p_league_id and p.user_id = v_user;
  delete from public.tregu_league_ranks r where r.league_id = p_league_id and r.user_id = v_user;
  delete from public.tregu_league_members m where m.league_id = p_league_id and m.user_id = v_user;

  if v_refund > 0 then
    update public.profiles set coins = coins + v_refund where id = v_user;
    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'league_fee', v_refund, jsonb_build_object(
      'league_id', p_league_id,
      'note', format('Rimbursim: dole nga "%s"', v_league.name)));
  elsif coalesce(v_member.fee_paid, 0) > 0 then
    update public.tregu_leagues set forfeited = forfeited + v_member.fee_paid where id = p_league_id;
  end if;

  if v_members = 1 then
    -- The last one out closes the league. Fees others left behind have no one
    -- to go to and are not paid out (the same as a league nobody scored in).
    insert into public.tregu_league_audit (league_id, name, action, forfeited, actor)
    values (p_league_id, v_league.name, 'deleted_last_member', v_league.forfeited, v_user);
    delete from public.tregu_leagues l where l.id = p_league_id;
    v_deleted := true;
  end if;

  select coins into v_balance from public.profiles where id = v_user;
  return query select v_balance, v_refund, v_deleted;
end;
$$;
revoke all on function public.tregu_league_leave(uuid) from public, anon;
grant execute on function public.tregu_league_leave(uuid) to authenticated;

-- ============================================================================
-- Readers: listed leagues are visible to everyone; the pot includes forfeits
-- ============================================================================

-- Pickable markets of a league, locking before p_until. One definition for the
-- pick board, the hub and the picks-due nudge.
create or replace function public.tregu_league_open_markets(p_league_id uuid, p_until timestamptz)
returns table (market_id uuid, lock_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select mk.id, lk.lock_at
  from public.tregu_leagues l
  join public.markets mk on mk.status = 'open'
  cross join lateral (select public.tregu_market_lock_at(mk.live_event, mk.closes_at) as lock_at) lk
  where l.id = p_league_id
    and public.tregu_league_scope_match(l.scope_kind, l.scope_value, mk.id)
    and lk.lock_at > now()
    and lk.lock_at >= l.starts_at
    and lk.lock_at <= l.ends_at
    and lk.lock_at <= p_until;
$$;
revoke all on function public.tregu_league_open_markets(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.tregu_leagues_overview()
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
    select m.league_id, count(*)::int as n
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
    public.tregu_league_pot(v.id), coalesce(c.n, 0), v.max_members,
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

-- The preview gains `listed` (the league page's join button needs it).
drop function if exists public.tregu_league_preview(text, uuid);
create function public.tregu_league_preview(p_code text default null, p_league_id uuid default null)
returns table (
  id uuid, name text, kind text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, settled boolean,
  description text, rules text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text, sponsor_logo text, sponsor_url text,
  listed boolean, is_creator boolean, forfeited numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.name, l.kind, l.starts_at, l.ends_at, l.entry_fee, l.prizes,
    public.tregu_league_pot(l.id),
    (select count(*)::int from public.tregu_league_members m where m.league_id = l.id),
    l.max_members,
    exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()),
    l.settled_at is not null,
    l.description, l.rules, l.emblem, l.color, l.cover_url, l.sponsor, l.scope_kind, l.scope_value,
    l.sponsor_logo, l.sponsor_url,
    l.listed, coalesce(l.creator_id = auth.uid(), false), l.forfeited
  from public.tregu_leagues l
  where (p_code is not null and l.code = upper(trim(p_code)))
     or (p_league_id is not null and l.id = p_league_id and (
          l.kind = 'public' or l.listed
          or exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid())
        ));
$$;
grant execute on function public.tregu_league_preview(text, uuid) to anon, authenticated;

create or replace function public.tregu_league_standings(p_league_id uuid)
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
    and (l.kind = 'public' or l.listed or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  order by r.place;
$$;

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
      and (l.kind = 'public' or l.listed or exists (
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

create or replace function public.tregu_league_feed(p_league_id uuid)
returns table (kind text, display_name text, amount numeric, question text, slug text, at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select * from public.tregu_leagues l
    where l.id = p_league_id
      and (l.kind = 'public' or l.listed or exists (
        select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
      ))
  ),
  events as (
    select 'close'::text as kind, c.uid, c.pnl as amount, mk.question, mk.slug, c.closed_at as at
    from lg
    join public.tregu_league_members m on m.league_id = lg.id
    join public.tregu_closed_trades() c on c.uid = m.user_id
    join public.markets mk on mk.id = c.mid
    where c.closed_at >= greatest(lg.starts_at, m.joined_at)
      and c.closed_at < lg.ends_at
      and public.tregu_league_scope_match(lg.scope_kind, lg.scope_value, c.mid)
    union all
    select 'join'::text, m.user_id, m.fee_paid, null, null, m.joined_at
    from lg
    join public.tregu_league_members m on m.league_id = lg.id
  )
  select e.kind, coalesce(nullif(trim(p.display_name), ''), 'Tregtar'), round(e.amount, 0), e.question, e.slug, e.at
  from events e
  join public.profiles p on p.id = e.uid
  order by e.at desc
  limit 25;
$$;

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
    and (l.kind = 'public' or l.listed or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  group by p.league_id, p.user_id;
$$;

-- Settlement: identical to 0089 except the pot, which now includes forfeits.
-- When nobody scored, members get their own fees back and forfeits stay unpaid.
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

    v_pot := public.tregu_league_pot(v_league.id);

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
    'pot', public.tregu_league_pot(lg.id),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('place', s.place, 'name', s.name, 'points', s.pts, 'me', s.me) order by s.place) from shown s), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('slug', m.slug, 'question', m.question, 'lock_at', m.lock_at, 'options', m.options) order by m.lock_at) from matches m), '[]'::jsonb)
  )
  from lg;
$$;

-- ============================================================================
-- The hub: every league card on the floor, in one call
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
    select distinct on (k.league_id) k.league_id, k.name, k.pts
    from (
      select p.league_id, p.user_id,
        split_part(coalesce(nullif(trim(pr.display_name), ''), 'Tregtar'), ' ', 1) as name,
        sum(p.points) as pts
      from public.tregu_league_picks p
      join public.markets mk on mk.id = p.market_id
      join public.profiles pr on pr.id = p.user_id
      where p.league_id in (select pk.id from picked pk)
        and mk.status = 'resolved' and mk.outcome = p.outcome
        and public.tregu_kosovo_day(mk.resolved_at) = public.tregu_kosovo_day()
      group by p.league_id, p.user_id, pr.display_name
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

create or replace function public.tregu_league_search(p_query text)
returns table (
  id uuid, name text, kind text, listed boolean,
  starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, active_today int,
  emblem text, color text, scope_kind text, scope_value text
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select trim(coalesce(p_query, '')) as raw
  ),
  pattern as (
    select raw, replace(replace(replace(lower(raw), '\', '\\'), '%', '\%'), '_', '\_') as esc
    from q where char_length(raw) between 2 and 40
  )
  select
    l.id, l.name, l.kind, l.listed, l.starts_at, l.ends_at,
    l.entry_fee, l.prizes, public.tregu_league_pot(l.id),
    (select count(*)::int from public.tregu_league_members m where m.league_id = l.id),
    l.max_members,
    exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()),
    (select count(distinct p.user_id)::int from public.tregu_league_picks p
      where p.league_id = l.id and p.updated_at > now() - interval '24 hours'),
    l.emblem, l.color, l.scope_kind, l.scope_value
  from public.tregu_leagues l, pattern
  where (l.kind = 'public' or l.listed)
    and l.settled_at is null and l.ends_at > now()
    and lower(l.name) like '%' || pattern.esc || '%' escape '\'
  order by (lower(l.name) like pattern.esc || '%' escape '\') desc, 13 desc, 10 desc, l.ends_at
  limit 20;
$$;
grant execute on function public.tregu_league_search(text) to anon, authenticated;

-- ============================================================================
-- Picks due: one reminder per reader per Kosovo day
-- ============================================================================

alter table public.tregu_league_events drop constraint if exists tregu_league_events_kind_check;
alter table public.tregu_league_events add constraint tregu_league_events_kind_check
  check (kind in ('overtaken', 'climbed', 'duel_challenge', 'duel_accepted', 'duel_declined',
                  'duel_won', 'duel_lost', 'duel_draw', 'duel_expired', 'picks_due'));
alter table public.tregu_league_events drop constraint if exists tregu_league_events_picks_due_day_check;
alter table public.tregu_league_events add constraint tregu_league_events_picks_due_day_check
  check (kind <> 'picks_due' or data ? 'day');
create unique index if not exists tregu_league_events_picks_due_day_key
  on public.tregu_league_events (user_id, (data ->> 'day')) where kind = 'picks_due';

-- Queues today's reminder for every reader with push on whose first unpicked
-- match locks 15 minutes to 2 hours from now, between 09:00 and 21:00 Kosovo
-- time. The event names the league whose match locks first.
create or replace function public.tregu_queue_picks_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour int := extract(hour from now() at time zone 'Europe/Belgrade')::int;
  v_day text := public.tregu_kosovo_day()::text;
  v_count int;
begin
  if v_hour < 9 or v_hour >= 21 then return 0; end if;

  with active as (
    select l.id, l.name from public.tregu_leagues l
    where l.settled_at is null and l.starts_at <= now() and l.ends_at > now()
      and exists (
        select 1 from public.tregu_league_members m
        join public.tregu_push_subscriptions s on s.user_id = m.user_id
        where m.league_id = l.id
      )
  ),
  open_markets as (
    select a.id as league_id, a.name, o.market_id, o.lock_at
    from active a
    cross join lateral public.tregu_league_open_markets(a.id, now() + interval '24 hours') o
  ),
  due as (
    select m.user_id, om.league_id, om.name,
      count(*)::int as open_count,
      min(om.lock_at) as first_lock
    from open_markets om
    join public.tregu_league_members m on m.league_id = om.league_id
    where m.user_id in (select s.user_id from public.tregu_push_subscriptions s)
      and not exists (
        select 1 from public.tregu_league_picks p
        where p.league_id = om.league_id and p.user_id = m.user_id and p.market_id = om.market_id
      )
    group by m.user_id, om.league_id, om.name
  ),
  best as (
    -- The league whose match locks first; on a tie, the one they rank best in.
    select distinct on (d.user_id) d.user_id, d.league_id, d.name, d.open_count, r.rank, d.first_lock
    from due d
    left join public.tregu_league_ranks r on r.league_id = d.league_id and r.user_id = d.user_id
    order by d.user_id, d.first_lock, r.rank asc nulls last
  ),
  queued as (
    insert into public.tregu_league_events (user_id, league_id, kind, data)
    select b.user_id, b.league_id, 'picks_due', jsonb_build_object(
      'day', v_day, 'league', b.name, 'league_id', b.league_id,
      'rank', b.rank, 'open', b.open_count, 'lock_at', b.first_lock)
    from best b
    where b.first_lock > now() + interval '15 minutes'
      and b.first_lock <= now() + interval '2 hours'
    on conflict (user_id, (data ->> 'day')) where kind = 'picks_due' do nothing
    returning 1
  )
  select count(*)::int into v_count from queued;
  return v_count;
end;
$$;
revoke all on function public.tregu_queue_picks_due() from public, anon, authenticated;
grant execute on function public.tregu_queue_picks_due() to service_role;

notify pgrst, 'reload schema';
