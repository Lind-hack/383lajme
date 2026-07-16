-- 0014 — Keep every three-outcome live-sport oracle snapshot within the
-- existing market_snapshots_oracle_cap_check ceiling (0.10). This migration
-- deliberately does not alter the constraint or existing market/position rows.

create or replace function public.apply_sport_market_oracle(
  p_market_id uuid,
  p_provider text,
  p_event_id text,
  p_state jsonb,
  p_reference_probabilities jsonb,
  p_evidence jsonb,
  p_reasoning text,
  p_requested_cap numeric,
  p_close_market boolean,
  p_verified_outcome text,
  p_settlement_due_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_key text;
  v_sum numeric := 0;
  v_target jsonb := '{}'::jsonb;
  v_current jsonb;
  v_new jsonb := '{}'::jsonb;
  v_probability numeric;
  v_cap numeric;
begin
  if p_provider <> 'espn' or coalesce(p_event_id, '') = '' or coalesce(p_state->>'key', '') = '' then
    raise exception 'Kërkohet eventi zyrtar ESPN';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.live_event->>'provider' <> 'espn'
    or v_market.live_event->>'event_id' <> p_event_id then
    raise exception 'Tregu sportiv nuk përputhet';
  end if;
  if p_close_market and (p_verified_outcome is null or p_settlement_due_at is null) then
    raise exception 'Finalja zyrtare kërkon rezultat dhe kohë zgjidhjeje';
  end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then
    return;
  end if;

  -- The table's existing check is authoritative: do not request or record a
  -- larger movement, including official-final and supplemental-stat updates.
  v_cap := least(0.10, greatest(0.001, p_requested_cap));
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_probability := (p_reference_probabilities->>v_key)::numeric;
    if v_probability is null or v_probability < 0 or v_probability >= 1 then
      raise exception 'Probabilitetet duhet të jenë të fundme dhe nën 100 për qind';
    end if;
    v_sum := v_sum + v_probability;
  end loop;
  if abs(v_sum - 1) > 0.000001 then
    raise exception 'Çmimet duhet të bëjnë 100 për qind';
  end if;

  v_current := coalesce(v_market.reference_probabilities, p_reference_probabilities);
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_probability := least(
      (v_current->>v_key)::numeric + v_cap,
      greatest((v_current->>v_key)::numeric - v_cap, (p_reference_probabilities->>v_key)::numeric)
    );
    v_target := v_target || jsonb_build_object(v_key, v_probability);
  end loop;
  for v_key in select value->>'key' from jsonb_array_elements(v_market.sport_outcomes) value loop
    v_new := v_new || jsonb_build_object(
      v_key,
      (v_target->>v_key)::numeric / (select sum(value::numeric) from jsonb_each_text(v_target))
    );
  end loop;

  update public.markets
  set outcome_quantities = (
        select jsonb_object_agg(key, v_market.b * ln(value::numeric))
        from jsonb_each_text(v_new)
      ),
      reference_probabilities = v_new,
      live_score_state = p_state,
      status = case when p_close_market then 'closed' else 'open' end,
      official_final_at = case when p_close_market then now() else official_final_at end,
      settlement_due_at = case when p_close_market then p_settlement_due_at else settlement_due_at end,
      outcome = case when p_close_market then p_verified_outcome else outcome end,
      closes_at = case when p_close_market then least(closes_at, now()) else closes_at end,
      updated_at = now()
  where id = p_market_id;

  insert into public.sport_oracle_events (
    market_id, provider, event_id, state_key, source_url, official_state,
    reference_probabilities, reasoning
  ) values (
    p_market_id, p_provider, p_event_id, p_state->>'key', p_state->>'source_url',
    p_state, v_new, p_reasoning
  );
  insert into public.market_snapshots (
    market_id, oracle_kind, market_prob, reference_probability, oracle_cap,
    evidence, oracle_reasoning
  ) values (
    p_market_id, 'sport_oracle', coalesce((v_new->>'home')::numeric, 0),
    coalesce((p_reference_probabilities->>'home')::numeric, 0), v_cap,
    p_evidence, p_reasoning
  );
end;
$$;

revoke all on function public.apply_sport_market_oracle(uuid, text, text, jsonb, jsonb, jsonb, text, numeric, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_sport_market_oracle(uuid, text, text, jsonb, jsonb, jsonb, text, numeric, boolean, text, timestamptz) to service_role;
