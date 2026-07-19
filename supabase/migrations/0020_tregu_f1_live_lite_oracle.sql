-- 0019 — Bounded, attributable F1 Live Lite oracle for the existing Belgian GP
-- driver binary markets. This touches neither balances nor the 383C trade ledger.
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
  if coalesce(p_state->>'provider', '') <> 'formula1'
    or coalesce(p_state->>'key', '') = ''
    or p_state->>'source_url' <> 'https://www.formula1.com/en/timing/f1-live-lite' then
    raise exception 'Kërkohet leaderboard-i zyrtar F1 Live Lite';
  end if;
  if p_reference_probability is null or p_reference_probability < 0.001 or p_reference_probability > 0.999 then
    raise exception 'Probabiliteti i F1 oracle duhet të jetë i fundëm';
  end if;
  if jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) = 0 then
    raise exception 'F1 oracle kërkon provë zyrtare';
  end if;
  v_cap := least(0.05, greatest(0.001, coalesce(p_requested_cap, 0)));

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.market_type <> 'binary'
    or v_market.slug not like 'f1-belgjika-spa-fiton-%' then
    raise exception 'Tregu F1 nuk përputhet';
  end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then return; end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_target_price := least(v_current_price + v_cap, greatest(v_current_price - v_cap, p_reference_probability));
  v_delta := v_market.b * (ln(v_target_price / (1 - v_target_price)) - ln(v_current_price / (1 - v_current_price)));
  update public.markets set
    q_yes = v_market.q_yes + v_delta / 2,
    q_no = v_market.q_no - v_delta / 2,
    live_score_state = p_state,
    updated_at = now()
  where id = p_market_id and status = 'open';

  select coalesce(sum(abs(amount)), 0) into v_volume from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob, oracle_cap, volume
  ) values (
    p_market_id, p_reference_probability, p_reference_probability, 'f1_live_lite', p_oracle_reasoning,
    array['formula1:f1-live-lite'], p_evidence, array['Formula 1 official Live Lite'],
    v_current_price, v_target_price, v_cap, v_volume
  );
  return query select v_target_price, v_current_price, v_cap;
end;
$$;

revoke all on function public.apply_f1_market_oracle(uuid, jsonb, numeric, text, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.apply_f1_market_oracle(uuid, jsonb, numeric, text, jsonb, numeric) to service_role;
