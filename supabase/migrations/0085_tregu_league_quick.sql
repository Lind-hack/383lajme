-- 383 Tregu — leagues from the floor card: edit-after-create and a live pulse
--
-- Run once, in one transaction, like every other migration here.
--
-- The floor card creates a private league in one tap with defaults (free,
-- one week) and lets the creator adjust it in place. Adjusting is allowed only
-- while the creator is the league's sole member, so nobody who already joined
-- on one set of terms finds them changed. A fee change settles the
-- difference against the creator's balance.

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
  v_fee numeric := round(coalesce(p_entry_fee, 0));
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
  if v_fee < 0 or v_fee > 1000 then raise exception 'Tarifa duhet të jetë 0 deri në 1 000 monedha.'; end if;

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

revoke all on function public.tregu_league_update(uuid, text, int, numeric) from public, anon;
grant execute on function public.tregu_league_update(uuid, text, int, numeric) to authenticated;

-- The card's "N po luajnë": players and leagues running right now, plus the
-- first names of a few recent public-league joiners. Private memberships are
-- counted but never named.
create or replace function public.tregu_leagues_pulse()
returns table (players int, leagues int, faces text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(distinct m.user_id)::int
       from public.tregu_league_members m
       join public.tregu_leagues l on l.id = m.league_id
      where l.ends_at > now() and l.settled_at is null),
    (select count(*)::int from public.tregu_leagues l where l.ends_at > now() and l.settled_at is null),
    (coalesce((
      select array_agg(f.name order by f.joined_at desc)
      from (
        select distinct on (m.user_id)
          split_part(coalesce(nullif(trim(p.display_name), ''), 'Tregtar'), ' ', 1) as name,
          m.joined_at
        from public.tregu_league_members m
        join public.tregu_leagues l on l.id = m.league_id
        join public.profiles p on p.id = m.user_id
        where l.kind = 'public' and l.ends_at > now()
        order by m.user_id, m.joined_at desc
      ) f
    ), array[]::text[]))[1:5];
$$;

grant execute on function public.tregu_leagues_pulse() to anon, authenticated;
