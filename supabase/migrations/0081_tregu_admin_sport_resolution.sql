-- A sport market whose provider never publishes a machine-readable final
-- (a legacy F1 market without a session key, an FBK game with no feed) had no
-- way to close: the only writer of a sport outcome was the provider oracle.
-- This is the fallback. It locks the market with the given winner and makes it
-- due immediately; settle_due_sport_markets() pays it exactly as it pays an
-- oracle final, through the same idempotent settlement ledger.
begin;

create or replace function public.admin_resolve_sport_market(
  p_market_id uuid,
  p_outcome text,
  p_evidence jsonb default '[]'::jsonb,
  p_reasoning text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_market public.markets%rowtype;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found then raise exception 'Tregu market not found'; end if;
  if v_market.market_type not in ('two_outcome', 'three_outcome', 'f1_race_winner') then
    raise exception 'Only sport markets resolve here; binary markets use resolve_market';
  end if;
  if v_market.status = 'resolved' then return false; end if;
  if v_market.status not in ('open', 'closed', 'stale') then
    raise exception 'Market status % cannot be resolved', v_market.status;
  end if;
  if v_market.outcome is not null and v_market.outcome <> p_outcome then
    raise exception 'Market is already locked to outcome %', v_market.outcome;
  end if;
  if not (coalesce(v_market.sport_outcomes, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('key', p_outcome))) then
    raise exception 'Outcome % is not one of this market''s outcomes', p_outcome;
  end if;

  update public.markets set
    status = 'closed',
    outcome = p_outcome,
    closes_at = least(closes_at, now()),
    official_final_at = coalesce(official_final_at, now()),
    settlement_due_at = now(),
    resolution_evidence = coalesce(p_evidence, '[]'::jsonb),
    resolution_reasoning = coalesce(p_reasoning, 'Rezultati zyrtar u vendos manualisht.'),
    last_scan_result = jsonb_build_object('status', 'admin_resolved', 'outcome', p_outcome, 'checked_at', now()),
    updated_at = now()
  where id = p_market_id;
  return true;
end;
$$;

revoke all on function public.admin_resolve_sport_market(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_resolve_sport_market(uuid, text, jsonb, text) to service_role;

commit;
