-- Settle the persistent season championship only after the OpenF1-backed
-- model reports that the points lead is mathematically unassailable.
create or replace function public.settle_f1_championship_market(
  p_market_id uuid,
  p_winner text,
  p_state_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_position record;
  v_settlement_id uuid;
  v_transaction_id uuid;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'F1 championship market was not found'; end if;
  if v_market.status = 'resolved' then return; end if;
  if v_market.status <> 'open'
     or v_market.market_type <> 'f1_race_winner'
     or v_market.market_classification <> 'live_f1'
     or v_market.live_event->>'event_kind' <> 'championship'
     or v_market.live_event->>'provider' <> 'formula1_dashboard' then
    raise exception 'F1 championship market is not configured';
  end if;
  if coalesce(p_state_key, '') = '' or v_market.live_score_state->>'key' <> p_state_key then
    raise exception 'F1 championship settlement state is stale';
  end if;
  if coalesce((v_market.live_score_state->'championship'->>'decided')::boolean, false) is not true then
    raise exception 'F1 title is not mathematically decided';
  end if;
  if p_winner !~ '^[A-Z]{3}$' or not exists (
    select 1 from jsonb_array_elements(v_market.sport_outcomes) outcome(value)
    where outcome.value->>'key' = p_winner
  ) then raise exception 'F1 champion is not a configured driver'; end if;

  for v_position in select * from public.positions where market_id = v_market.id and shares > 0 for update loop
    v_settlement_id := null;
    insert into public.sport_market_settlements (market_id, user_id, side, shares)
    values (v_market.id, v_position.user_id, v_position.side, v_position.shares)
    on conflict (market_id, user_id, side) do nothing
    returning id into v_settlement_id;
    if v_settlement_id is not null and v_position.side = p_winner then
      update public.profiles set coins = coins + v_position.shares where id = v_position.user_id;
      insert into public.transactions (user_id, type, amount, market_id, meta)
      values (v_position.user_id, 'payout', v_position.shares, v_market.id,
        jsonb_build_object('side', v_position.side, 'currency', '383C_virtual', 'settlement', 'openf1_championship_decided'))
      returning id into v_transaction_id;
      update public.sport_market_settlements set transaction_id = v_transaction_id where id = v_settlement_id;
    end if;
    update public.positions set shares = 0, coins_staked = 0, updated_at = now() where id = v_position.id;
  end loop;

  update public.markets
  set status = 'resolved', outcome = p_winner, resolved_at = now(), closes_at = least(closes_at, now()), updated_at = now()
  where id = v_market.id;
end;
$$;

revoke all on function public.settle_f1_championship_market(uuid, text, text) from public, anon, authenticated;
grant execute on function public.settle_f1_championship_market(uuid, text, text) to service_role;
