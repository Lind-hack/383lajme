-- 0009 — Recognize ESPN's official FULL_TIME/FT state when closing live-score markets.
-- This migration is submitted for review only. It is not applied by this change.

create or replace function public.apply_live_score_oracle(
  p_market_id uuid,
  p_provider text,
  p_event_id text,
  p_state jsonb,
  p_reference_probability numeric,
  p_oracle_reasoning text,
  p_evidence jsonb,
  p_close_market boolean,
  p_requested_cap numeric
)
returns table (new_price_yes numeric, previous_price_yes numeric, applied_cap numeric, market_closed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_current_price numeric;
  v_target_price numeric;
  v_reference_probability numeric;
  v_cap numeric;
  v_oracle_delta numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_volume numeric;
begin
  if p_provider <> 'espn' then raise exception 'Kërkohet scoreboard-i zyrtar ESPN'; end if;
  if coalesce(p_event_id, '') = '' or coalesce(p_state->>'key', '') = '' then raise exception 'Gjendja zyrtare e ndeshjes mungon'; end if;
  if p_reference_probability is null or p_reference_probability < 0 or p_reference_probability > 1 then
    raise exception 'Probabiliteti i oracle duhet të jetë mes 0 dhe 1';
  end if;
  if jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) = 0 then
    raise exception 'Oracle kërkon provë zyrtare';
  end if;

  v_cap := least(0.10, greatest(0, coalesce(p_requested_cap, 0)));
  if v_cap = 0 then raise exception 'Oracle kërkon kufi pozitiv'; end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.live_event->>'provider' <> p_provider or v_market.live_event->>'event_id' <> p_event_id then
    raise exception 'Ngjarja zyrtare nuk përputhet me tregun';
  end if;
  if p_close_market and not (
    coalesce(p_state->>'status', '') ~* '(FINAL|POST|CANCELED|FULL_TIME)'
    or upper(trim(coalesce(p_state->>'detail', ''))) = 'FT'
  ) then
    raise exception 'Vetëm statusi përfundimtar zyrtar mund ta mbyllë tregun';
  end if;
  if v_market.closes_at <= now() and not p_close_market then raise exception 'Tregu është mbyllur'; end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then
    return;
  end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_reference_probability := least(0.999, greatest(0.001, p_reference_probability));
  v_target_price := least(v_current_price + v_cap, greatest(v_current_price - v_cap, v_reference_probability));
  v_oracle_delta := v_market.b * (ln(v_target_price / (1 - v_target_price)) - ln(v_current_price / (1 - v_current_price)));
  v_new_q_yes := v_market.q_yes + v_oracle_delta / 2;
  v_new_q_no := v_market.q_no - v_oracle_delta / 2;

  update public.markets
    set q_yes = v_new_q_yes,
        q_no = v_new_q_no,
        live_score_state = p_state,
        status = case when p_close_market then 'closed' else 'open' end,
        closes_at = case when p_close_market then least(closes_at, now()) else closes_at end,
        updated_at = now()
    where id = p_market_id;

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob, oracle_cap, volume
  ) values (
    p_market_id, p_reference_probability, p_reference_probability, 'live_score', p_oracle_reasoning,
    array[concat('espn:', p_event_id)], p_evidence, array['ESPN official scoreboard'],
    v_current_price, v_target_price, v_cap, v_volume
  );

  return query select v_target_price, v_current_price, v_cap, p_close_market;
end;
$$;

revoke all on function public.apply_live_score_oracle(uuid, text, text, jsonb, numeric, text, jsonb, boolean, numeric) from public, anon, authenticated;
grant execute on function public.apply_live_score_oracle(uuid, text, text, jsonb, numeric, text, jsonb, boolean, numeric) to service_role;
