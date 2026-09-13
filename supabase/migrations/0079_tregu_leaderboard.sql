-- 383 Tregu — trader leaderboard (monthly + weekly, by realized trading profit)
--
-- Run once in the Supabase SQL editor, like every other migration here.
--
-- Why a SECURITY DEFINER function rather than a view or a service-role route:
--   * transactions is RLS'd to "users see their own", which is correct and must
--     stay that way. A leaderboard needs to read across users, so it has to be
--     a definer function — the alternative is shipping the service-role key to
--     a public, high-traffic page, which is not a trade worth making.
--   * The function returns ONLY display_name, rank and profit. It never returns
--     a user id, an email, or anything that could be joined back to a person's
--     trade history. profiles already carries a public-select policy for
--     exactly this ("leaderboard-safe fields only", 0001_tregu_schema.sql:28).
--
-- Profit definition: the signed sum of trading transactions only.
--   bet     negative (coins leave the wallet)
--   sell    positive (position closed early)
--   payout  positive (market resolved in the trader's favour)
-- Bonuses and withdrawals are deliberately excluded — a leaderboard that counts
-- the daily bonus ranks whoever logs in most, not whoever predicts best.

create or replace function public.tregu_leaderboard(p_days int default 30, p_limit int default 5)
returns table (
  rank bigint,
  display_name text,
  profit numeric,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  with scored as (
    select
      t.user_id,
      sum(t.amount) as profit
    from public.transactions t
    where t.type in ('bet', 'sell', 'payout')
      and t.created_at >= now() - make_interval(days => greatest(1, p_days))
    group by t.user_id
  ),
  ranked as (
    select
      row_number() over (order by s.profit desc, s.user_id) as rank,
      s.user_id,
      s.profit
    from scored s
    -- A trader who is down on the period is not "best"; showing negative
    -- leaders would make the podium read as a loss board on a quiet week.
    where s.profit > 0
  )
  select
    r.rank,
    coalesce(nullif(trim(p.display_name), ''), 'Tregtar') as display_name,
    round(r.profit, 0) as profit,
    (r.user_id = auth.uid()) as is_me
  from ranked r
  join public.profiles p on p.id = r.user_id
  -- Top N, plus the caller's own row however far down it is, so the card can
  -- always answer "and where am I" without a second query.
  where r.rank <= greatest(1, p_limit) or r.user_id = auth.uid()
  order by r.rank;
$$;

-- Anon may call it: the floor shows the board to logged-out visitors too, and
-- the function exposes nothing that is not already public.
grant execute on function public.tregu_leaderboard(int, int) to anon, authenticated;

-- The scan is user_id + created_at over a rolling window, every page load.
create index if not exists transactions_user_created_type_idx
  on public.transactions (user_id, created_at desc)
  where type in ('bet', 'sell', 'payout');
