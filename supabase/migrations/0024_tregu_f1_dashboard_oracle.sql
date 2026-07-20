-- Generic Formula 1 Dashboard oracle for explicitly configured live_f1 binary markets.
-- Apply after 0020 and 0023 before enabling the two-minute F1 worker.
create or replace function public.apply_f1_market_oracle(
  p_market_id uuid,
  p_state jsonb,
  p_reference_probability numeric,
  p_oracle_reasoning text,
  p_evidence jsonb,
  p_requested_cap numeric
)
returns table (new_price_yes numeric, previous_price_yes numeric, applied_cap numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_current_price numeric;
  v_target_price numeric;
  v_cap numeric;
  v_delta numeric;
  v_volume numeric;
begin
  if coalesce(p_state->>'provider', '') <> 'formula1_dashboard'
    or coalesce(p_state->>'key', '') = ''
    or p_state->>'source_url' <> 'https://app.formula1dashboard.com/live-timing/'
    or coalesce(p_state->>'event_id', '') !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Kërkohet leaderboard-i Formula 1 Dashboard me garë të identifikuar';
  end if;
  if p_reference_probability is null or p_reference_probability < 0.001 or p_reference_probability > 0.999 then
    raise exception 'Probabiliteti i F1 oracle duhet të jetë i fundëm';
  end if;
  if jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) = 0 then
    raise exception 'F1 oracle kërkon provë burimore';
  end if;
  v_cap := least(0.05, greatest(0.001, coalesce(p_requested_cap, 0)));

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.market_type <> 'binary'
    or v_market.market_classification <> 'live_f1'
    or v_market.live_event->>'provider' <> 'formula1_dashboard'
    or v_market.live_event->>'event_id' <> p_state->>'event_id'
    or coalesce(v_market.live_event->>'driver_code', '') !~ '^[A-Z]{3}$' then
    raise exception 'Tregu F1 nuk përputhet me konfigurimin e garës';
  end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then return; end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_target_price := least(v_current_price + v_cap, greatest(v_current_price - v_cap, p_reference_probability));
  v_delta := v_market.b * (ln(v_target_price / (1 - v_target_price)) - ln(v_current_price / (1 - v_current_price)));
  update public.markets set q_yes = v_market.q_yes + v_delta / 2, q_no = v_market.q_no - v_delta / 2,
    live_score_state = p_state, updated_at = now() where id = p_market_id and status = 'open';

  select coalesce(sum(abs(amount)), 0) into v_volume from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob, oracle_cap, volume)
  values (p_market_id, p_reference_probability, p_reference_probability, 'f1_dashboard', p_oracle_reasoning,
    array[concat('formula1-dashboard:', p_state->>'event_id')], p_evidence, array['Formula 1 Dashboard'],
    v_current_price, v_target_price, v_cap, v_volume);
  return query select v_target_price, v_current_price, v_cap;
end;
$$;

revoke all on function public.apply_f1_market_oracle(uuid, jsonb, numeric, text, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.apply_f1_market_oracle(uuid, jsonb, numeric, text, jsonb, numeric) to service_role;
