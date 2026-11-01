-- 383 Tregu: a sports trade lands on the board when its match ended, not when
-- our worker got round to settling it.
--
-- Run once, in one transaction, like every other migration here.
--
-- 0100 dates a held side's result at the market's resolved_at, and a payout at
-- the payout's own timestamp. Both are the moment the settlement job ran. When
-- the two-minute sports heartbeat was down (2026-10-30 20:12 to 2026-11-01
-- 14:22 UTC), Saturday's matches settled on Sunday afternoon, so October
-- results landed in November: a trader who had not traded in November opened
-- the month on -30.
--
-- Now a market tied to a scheduled event (live_event.kickoff, or race_start
-- for F1) counts as concluded no later than three hours after the event began:
-- enough for extra time and penalties, overtime, or a full Grand Prix. A
-- settlement that runs on time is earlier than that cap and keeps its own
-- time; a late one is pulled back to the event. News markets, which have no
-- event time, are unchanged. Sells keep their own time: a sale is concluded
-- when it happens.
--
-- Only tregu_realized_trades changes; tregu_leaderboard_scores, the board, the
-- period lock and prizes read it as before. Periods already locked are not
-- re-judged.

create or replace function public.tregu_realized_trades(p_from timestamptz, p_to timestamptz)
returns table (uid uuid, mid uuid, pnl numeric, at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_key text := null;
  v_uid uuid;
  v_mid uuid;
  v_status text;
  v_settled timestamptz;
  v_ends timestamptz;
  v_last timestamptz;
  v_shares numeric := 0;
  v_cost numeric := 0;
  v_take numeric;
  v_sold numeric;
begin
  for r in
    select t.user_id, t.market_id, coalesce(t.meta->>'side', '') as side, t.type,
      t.amount::numeric as amount, t.created_at,
      case when (t.meta->>'shares') ~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' then (t.meta->>'shares')::numeric end as shares,
      m.status, coalesce(m.resolved_at, m.updated_at) as settled_at,
      -- When the event behind the market was over at the latest.
      case
        when coalesce(m.live_event->>'kickoff', m.live_event->>'race_start') ~ '^\d{4}-\d{2}-\d{2}T'
          then coalesce(m.live_event->>'kickoff', m.live_event->>'race_start')::timestamptz + interval '3 hours'
      end as ends_at
    from public.transactions t
    join public.markets m on m.id = t.market_id
    where t.type in ('bet', 'sell', 'payout') and t.market_id is not null
    order by t.user_id, t.market_id, side, t.created_at, t.id
  loop
    if v_key is distinct from (r.user_id::text || r.market_id::text || r.side) then
      -- Close the previous side: held into a resolution that did not pay it.
      if v_key is not null and v_status = 'resolved' and v_cost > 0.000001 then
        uid := v_uid; mid := v_mid; pnl := -v_cost;
        at := greatest(least(v_settled, coalesce(v_ends, v_settled)), v_last);
        if at >= p_from and at < p_to then return next; end if;
      end if;
      v_key := r.user_id::text || r.market_id::text || r.side;
      v_uid := r.user_id; v_mid := r.market_id; v_status := r.status; v_settled := r.settled_at; v_ends := r.ends_at;
      v_shares := 0; v_cost := 0;
    end if;
    v_last := r.created_at;

    if r.type = 'bet' then
      v_shares := v_shares + coalesce(r.shares, 0);
      v_cost := v_cost + abs(r.amount);
    elsif r.type = 'sell' then
      v_sold := coalesce(r.shares, v_shares);
      -- Selling (almost) everything takes the whole basis, so no dust of
      -- cost is left to resurface as a loss at resolution.
      v_take := case when v_shares <= 0.000001 or v_sold >= v_shares - 0.000001 then v_cost
                     else v_cost * v_sold / v_shares end;
      uid := r.user_id; mid := r.market_id; pnl := r.amount - v_take; at := r.created_at;
      if at >= p_from and at < p_to then return next; end if;
      v_cost := v_cost - v_take;
      v_shares := greatest(0, v_shares - v_sold);
    else -- payout: the side won; whatever is left of its cost is settled here
      uid := r.user_id; mid := r.market_id; pnl := r.amount - v_cost;
      at := least(r.created_at, coalesce(r.ends_at, r.created_at));
      if at >= p_from and at < p_to then return next; end if;
      v_cost := 0;
      v_shares := 0;
    end if;
  end loop;

  if v_key is not null and v_status = 'resolved' and v_cost > 0.000001 then
    uid := v_uid; mid := v_mid; pnl := -v_cost;
    at := greatest(least(v_settled, coalesce(v_ends, v_settled)), v_last);
    if at >= p_from and at < p_to then return next; end if;
  end if;
end;
$$;

revoke all on function public.tregu_realized_trades(timestamptz, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
