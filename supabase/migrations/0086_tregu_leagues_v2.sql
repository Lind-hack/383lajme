-- 383 Tregu — leagues v2: profiles, themed scoring, daily hooks, new money rules
--
-- Run once, in one transaction, like every other migration here.
--
-- Money (owner's rules, 28 Sep 2026):
--   * Private leagues are paid only from their members: the creator sets an
--     entry fee of 10 to 10 000 coins, the pot splits 50/30/20.
--   * Public leagues cost 10 coins to enter. 383 pays 75% of the leaderboard
--     prize for the league's length (weekly base up to 7 days, monthly base
--     beyond), set by the admin API into `prizes`; the members' fees are added
--     on top, split 50/30/20 among the winners. With no winner the fees go
--     back to everyone who paid.
--
-- Profiles: public leagues carry a description, rules, emblem, colour, cover
-- and sponsor line, and can be themed: only trades in one category (Kosovë,
-- Ekonomi…), one competition (Champions League, La Liga, Superliga…) or F1
-- count toward them.
--
-- Daily hooks: each standing now carries today's closed profit, the number of
-- trades closed in the league, and the member's trading streak (consecutive
-- Kosovo days with a buy or sell). A feed lists recent closes and joins.

-- ============================================================================
-- League profile + theme columns
-- ============================================================================

alter table public.tregu_leagues
  add column if not exists description text check (description is null or char_length(description) <= 280),
  add column if not exists rules text check (rules is null or char_length(rules) <= 1200),
  add column if not exists emblem text check (emblem is null or char_length(emblem) <= 500),
  add column if not exists color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists cover_url text check (cover_url is null or char_length(cover_url) <= 500),
  add column if not exists sponsor text check (sponsor is null or char_length(sponsor) <= 120),
  add column if not exists scope_kind text not null default 'all' check (scope_kind in ('all', 'category', 'competition', 'f1')),
  add column if not exists scope_value text;

alter table public.tregu_leagues drop constraint if exists tregu_leagues_entry_fee_check;
alter table public.tregu_leagues add constraint tregu_leagues_entry_fee_check
  check (entry_fee >= 0 and entry_fee <= 10000);

-- Emblems and covers uploaded from admin. Public read; writes only with the
-- service role (the admin API route).
insert into storage.buckets (id, name, public)
values ('league-media', 'league-media', true)
on conflict (id) do update set public = true;

-- ============================================================================
-- Closed trades now carry their market, so themed leagues can filter
-- ============================================================================

drop function if exists public.tregu_closed_trades();
create function public.tregu_closed_trades()
returns table (uid uuid, pnl numeric, closed_at timestamptz, mid uuid)
language sql
stable
security definer
set search_path = public
as $$
  with per_market as (
    select t.user_id as u, t.market_id as m_id, sum(t.amount) as net, max(t.created_at) as last_at
    from public.transactions t
    where t.type in ('bet', 'sell', 'payout')
      and t.market_id is not null
    group by t.user_id, t.market_id
  ),
  held as (
    select
      pm.*,
      m.status,
      coalesce(m.resolved_at, m.updated_at) as settled_at,
      exists (
        select 1 from public.positions p
        where p.user_id = pm.u and p.market_id = pm.m_id and p.shares > 0.000001
      ) as holding
    from per_market pm
    join public.markets m on m.id = pm.m_id
  )
  select
    h.u,
    h.net,
    case when h.holding then greatest(h.last_at, h.settled_at) else h.last_at end,
    h.m_id
  from held h
  where not h.holding or h.status = 'resolved';
$$;

revoke all on function public.tregu_closed_trades() from public, anon, authenticated;

-- Does a market count toward a league's theme?
create or replace function public.tregu_league_scope_match(p_kind text, p_value text, p_market uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case coalesce(p_kind, 'all')
    when 'all' then true
    when 'category' then exists (select 1 from public.markets m where m.id = p_market and lower(m.category) = lower(p_value))
    when 'competition' then exists (select 1 from public.markets m where m.id = p_market and m.live_event->>'league' = p_value)
    when 'f1' then exists (select 1 from public.markets m where m.id = p_market and (m.market_classification = 'live_f1' or m.market_type = 'f1_race_winner'))
    else false
  end;
$$;

revoke all on function public.tregu_league_scope_match(text, text, uuid) from public, anon, authenticated;

-- Consecutive Kosovo days, ending today or yesterday, with a buy or a sell.
create or replace function public.tregu_trading_streak(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select distinct (t.created_at at time zone 'Europe/Belgrade')::date as d
    from public.transactions t
    where t.user_id = p_user
      and t.type in ('bet', 'sell')
      and t.created_at > now() - interval '120 days'
  ),
  today as (select (now() at time zone 'Europe/Belgrade')::date as d),
  anchored as (
    select d, row_number() over (order by d desc) as n from days
  )
  select coalesce((
    select count(*)::int
    from anchored a, today
    where a.d = (select max(d) from days) - (a.n - 1)::int
      and (select max(d) from days) >= today.d - 1
  ), 0);
$$;

revoke all on function public.tregu_trading_streak(uuid) from public, anon, authenticated;

-- ============================================================================
-- Scores inside a league (themed, with today's profit and trade count)
-- ============================================================================

drop function if exists public.tregu_league_scores(uuid);
create function public.tregu_league_scores(p_league_id uuid)
returns table (uid uuid, net numeric, reached_at timestamptz, joined_at timestamptz, today_net numeric, trades int)
language sql
stable
security definer
set search_path = public
as $$
  with lg as (
    select * from public.tregu_leagues where id = p_league_id
  ),
  closed as (
    select c.*, m.joined_at as member_joined
    from public.tregu_closed_trades() c
    join public.tregu_league_members m on m.user_id = c.uid and m.league_id = p_league_id
    cross join lg
    where c.closed_at >= greatest(lg.starts_at, m.joined_at)
      and c.closed_at < lg.ends_at
      and public.tregu_league_scope_match(lg.scope_kind, lg.scope_value, c.mid)
  )
  select
    m.user_id,
    coalesce(sum(c.pnl), 0),
    max(c.closed_at),
    m.joined_at,
    coalesce(sum(c.pnl) filter (
      where (c.closed_at at time zone 'Europe/Belgrade')::date = (now() at time zone 'Europe/Belgrade')::date
    ), 0),
    count(c.uid)::int
  from public.tregu_league_members m
  left join closed c on c.uid = m.user_id
  where m.league_id = p_league_id
  group by m.user_id, m.joined_at;
$$;

revoke all on function public.tregu_league_scores(uuid) from public, anon, authenticated;
grant execute on function public.tregu_league_scores(uuid) to service_role;

-- ============================================================================
-- Client reads
-- ============================================================================

drop function if exists public.tregu_leagues_overview();
create function public.tregu_leagues_overview()
returns table (
  id uuid, name text, kind text, code text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, is_creator boolean, my_rank int, my_profit numeric, settled boolean,
  description text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text, faces text[]
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
  -- First names of up to five members, newest first: shown only where the
  -- caller may see the league's members anyway (public, or their own).
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
    coalesce(f.faces, array[]::text[])
  from visible v
  left join counts c on c.league_id = v.id
  left join mine mi on mi.league_id = v.id
  left join face_rows f on f.league_id = v.id
  order by (v.ends_at < now()), v.ends_at asc;
$$;

grant execute on function public.tregu_leagues_overview() to anon, authenticated;

drop function if exists public.tregu_league_preview(text, uuid);
create function public.tregu_league_preview(p_code text default null, p_league_id uuid default null)
returns table (
  id uuid, name text, kind text, starts_at timestamptz, ends_at timestamptz,
  entry_fee numeric, prizes numeric[], pot numeric, members int, max_members int,
  is_member boolean, settled boolean,
  description text, rules text, emblem text, color text, cover_url text, sponsor text,
  scope_kind text, scope_value text
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
    l.description, l.rules, l.emblem, l.color, l.cover_url, l.sponsor, l.scope_kind, l.scope_value
  from public.tregu_leagues l
  where (p_code is not null and l.code = upper(trim(p_code)))
     or (p_league_id is not null and l.id = p_league_id and (
          l.kind = 'public'
          or exists (select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid())
        ));
$$;

grant execute on function public.tregu_league_preview(text, uuid) to anon, authenticated;

drop function if exists public.tregu_league_standings(uuid);
create function public.tregu_league_standings(p_league_id uuid)
returns table (
  rank int, display_name text, profit numeric, is_me boolean, is_creator boolean,
  today_profit numeric, trades int, streak int, joined_at timestamptz
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
    r.joined_at
  from public.tregu_leagues l
  cross join lateral (
    select s.*,
      row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
    from public.tregu_league_scores(l.id) s
  ) r
  join public.profiles p on p.id = r.uid
  where l.id = p_league_id
    and (l.kind = 'public' or exists (
      select 1 from public.tregu_league_members m where m.league_id = l.id and m.user_id = auth.uid()
    ))
  order by r.place;
$$;

grant execute on function public.tregu_league_standings(uuid) to anon, authenticated;

-- Recent closes and joins, newest first. Same visibility as the standings.
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
      and (l.kind = 'public' or exists (
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

grant execute on function public.tregu_league_feed(uuid) to anon, authenticated;

-- The caller's league record: active leagues, best rank now, podiums won,
-- coins won from leagues, and trading streak.
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
-- Fees: private 10..10 000, set on create and editable while alone
-- ============================================================================

create or replace function public.tregu_league_create(p_name text, p_days int, p_entry_fee numeric default 10)
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
  if (select count(*) from public.tregu_leagues l
      where l.creator_id = v_user and l.kind = 'private' and l.ends_at > now()) >= 3 then
    raise exception 'Mund të kesh deri në 3 liga aktive njëherësh.';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.tregu_leagues l where l.code = v_code);
  end loop;

  insert into public.tregu_leagues (name, kind, code, creator_id, starts_at, ends_at, entry_fee)
  values (trim(p_name), 'private', v_code, v_user, now(), now() + make_interval(days => p_days), v_fee)
  returning tregu_leagues.id into v_id;

  select j.balance into v_balance from public.tregu_league_join(v_id, null) j;
  return query select v_id, v_code, v_balance;
end;
$$;

create or replace function public.tregu_league_update(
  p_league_id uuid,
  p_name text,
  p_days int,
  p_entry_fee numeric
)
returns table (id uuid, name text, ends_at timestamptz, entry_fee numeric, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_league public.tregu_leagues%rowtype;
  v_fee numeric := round(coalesce(p_entry_fee, 10));
  v_delta numeric;
  v_balance numeric;
begin
  if v_user is null then raise exception 'Duhet të hysh në llogari.'; end if;

  select * into v_league from public.tregu_leagues l where l.id = p_league_id for update;
  if not found or v_league.creator_id is distinct from v_user or v_league.kind <> 'private' then
    raise exception 'Vetëm krijuesi mund ta ndryshojë ligën.';
  end if;
  if v_league.ends_at <= now() or v_league.settled_at is not null then
    raise exception 'Kjo ligë ka përfunduar.';
  end if;
  if (select count(*) from public.tregu_league_members m where m.league_id = p_league_id) > 1 then
    raise exception 'Liga ka anëtarë: kushtet nuk ndryshohen më.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'Emri i ligës duhet të ketë 3 deri në 40 shkronja.';
  end if;
  if p_days not in (1, 3, 7, 14, 30) then raise exception 'Kohëzgjatja nuk vlen.'; end if;
  if v_fee < 10 or v_fee > 10000 then raise exception 'Tarifa duhet të jetë 10 deri në 10 000 monedha.'; end if;

  v_delta := v_fee - v_league.entry_fee;
  if v_delta > 0 then
    update public.profiles set coins = coins - v_delta
    where profiles.id = v_user and coins >= v_delta
    returning coins into v_balance;
    if not found then raise exception 'Nuk ke mjaft monedha për këtë tarifë.'; end if;
  elsif v_delta < 0 then
    update public.profiles set coins = coins - v_delta
    where profiles.id = v_user
    returning coins into v_balance;
  else
    select coins into v_balance from public.profiles where profiles.id = v_user;
  end if;

  if v_delta <> 0 then
    insert into public.transactions (user_id, type, amount, meta)
    values (v_user, 'league_fee', -v_delta, jsonb_build_object(
      'league_id', p_league_id,
      'note', case when v_delta > 0
        then format('Hyrje në ligën "%s"', trim(p_name))
        else format('Rimbursim tarife: liga "%s"', trim(p_name)) end
    ));
  end if;

  update public.tregu_league_members set fee_paid = v_fee
  where league_id = p_league_id and user_id = v_user;

  update public.tregu_leagues l
  set name = trim(p_name),
      ends_at = l.starts_at + make_interval(days => p_days),
      entry_fee = v_fee
  where l.id = p_league_id;

  return query
  select l.id, l.name, l.ends_at, l.entry_fee, v_balance
  from public.tregu_leagues l where l.id = p_league_id;
end;
$$;

revoke all on function public.tregu_league_create(text, int, numeric) from public, anon;
grant execute on function public.tregu_league_create(text, int, numeric) to authenticated;
revoke all on function public.tregu_league_update(uuid, text, int, numeric) from public, anon;
grant execute on function public.tregu_league_update(uuid, text, int, numeric) to authenticated;

-- ============================================================================
-- Settlement: public prizes = 383's fixed prizes + the fee pot
-- ============================================================================

create or replace function public.tregu_settle_due_leagues()
returns setof public.tregu_leaderboard_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league public.tregu_leagues%rowtype;
  v_pot numeric;
  v_members int;
  v_winners int;
  v_shares numeric[];
  v_share_sum numeric;
  v_amounts numeric[];
  v_i int;
begin
  for v_league in
    select * from public.tregu_leagues
    where settled_at is null and ends_at <= now()
    order by ends_at
    for update skip locked
  loop
    update public.tregu_leagues set settled_at = now() where id = v_league.id;

    select coalesce(sum(fee_paid), 0), count(*)::int into v_pot, v_members
    from public.tregu_league_members where league_id = v_league.id;

    if v_league.kind = 'public' then
      -- Winners are the members who are up, at most three.
      select least(3, count(*))::int into v_winners
      from public.tregu_league_scores(v_league.id) s where s.net > 0;

      if v_winners = 0 then
        -- Nobody won: every fee goes back, straight to the wallet.
        update public.profiles p set coins = p.coins + m.fee_paid
        from public.tregu_league_members m
        where m.league_id = v_league.id and m.user_id = p.id and m.fee_paid > 0;
        insert into public.transactions (user_id, type, amount, meta)
        select m.user_id, 'league_fee', m.fee_paid, jsonb_build_object(
          'league_id', v_league.id,
          'note', format('Rimbursim: liga "%s" mbylli pa fitues', v_league.name))
        from public.tregu_league_members m
        where m.league_id = v_league.id and m.fee_paid > 0;
        continue;
      end if;

      v_shares := (array[50, 30, 20]::numeric[])[1:v_winners];
      select sum(x) into v_share_sum from unnest(v_shares) x;
      v_amounts := array[]::numeric[];
      for v_i in 1..v_winners loop
        v_amounts := v_amounts || (coalesce(v_league.prizes[v_i], 0) + floor(v_pot * v_shares[v_i] / v_share_sum));
      end loop;
      v_amounts[1] := v_amounts[1] + (v_pot - (
        select coalesce(sum(floor(v_pot * s / v_share_sum)), 0) from unnest(v_shares) s
      ));

      return query
      insert into public.tregu_leaderboard_rewards
        (period_kind, period_start, period_end, place, user_id, display_name, profit, prize,
         status, league_id, league_name)
      select 'league', v_league.starts_at, v_league.ends_at, r.place, r.uid,
             coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
             round(r.net, 0), v_amounts[r.place], 'pending', v_league.id, v_league.name
      from (
        select s.uid, s.net,
          row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
        from public.tregu_league_scores(v_league.id) s
        where s.net > 0
      ) r
      join public.profiles p on p.id = r.uid
      where r.place <= v_winners and v_amounts[r.place] > 0
      returning *;
    else
      v_winners := least(3, v_members);
      if v_pot <= 0 or v_winners = 0 then
        continue;
      end if;

      v_shares := (array[50, 30, 20]::numeric[])[1:v_winners];
      select sum(x) into v_share_sum from unnest(v_shares) x;
      v_amounts := array[]::numeric[];
      for v_i in 1..v_winners loop
        v_amounts := v_amounts || floor(v_pot * v_shares[v_i] / v_share_sum);
      end loop;
      v_amounts[1] := v_amounts[1] + (v_pot - (select sum(x) from unnest(v_amounts) x));

      return query
      insert into public.tregu_leaderboard_rewards
        (period_kind, period_start, period_end, place, user_id, display_name, profit, prize,
         status, approved_at, league_id, league_name)
      select 'league', v_league.starts_at, v_league.ends_at, r.place, r.uid,
             coalesce(nullif(trim(p.display_name), ''), 'Tregtar'),
             round(r.net, 0), v_amounts[r.place], 'approved', now(), v_league.id, v_league.name
      from (
        select s.uid, s.net,
          row_number() over (order by s.net desc, s.reached_at asc nulls last, s.joined_at asc, s.uid)::int as place
        from public.tregu_league_scores(v_league.id) s
      ) r
      join public.profiles p on p.id = r.uid
      where r.place <= v_winners and v_amounts[r.place] > 0
      returning *;
    end if;
  end loop;
end;
$$;

revoke all on function public.tregu_settle_due_leagues() from public, anon, authenticated;
grant execute on function public.tregu_settle_due_leagues() to service_role;
