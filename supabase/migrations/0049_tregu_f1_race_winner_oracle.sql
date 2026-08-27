-- F1 race-winner vector oracle.
-- Keeps pre-race/live reference probabilities separate from user balances,
-- positions, transactions, and final settlement.

create or replace function public.apply_f1_race_winner_oracle(
  p_market_id uuid,
  p_state jsonb,
  p_probabilities jsonb,
  p_evidence jsonb,
  p_reasoning text,
  p_cap numeric,
  p_final boolean,
  p_winner text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_item jsonb;
  v_key text;
  v_current numeric;
  v_target numeric;
  v_sum numeric := 0;
  v_count integer;
  v_cap numeric;
  v_new jsonb := '{}'::jsonb;
  v_quantities jsonb := '{}'::jsonb;
  v_winner text := upper(coalesce(p_winner, ''));
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found
     or v_market.status <> 'open'
     or v_market.market_classification <> 'live_f1'
     or v_market.market_type <> 'f1_race_winner'
     or v_market.live_event->>'provider' <> 'formula1_dashboard'
     or jsonb_typeof(v_market.sport_outcomes) <> 'array'
     or jsonb_array_length(v_market.sport_outcomes) < 20
     or jsonb_array_length(v_market.sport_outcomes) > 22 then
    raise exception 'F1 race-winner market is not configured for vector updates';
  end if;
  if p_state is null or coalesce(p_state->>'key', '') = '' then
    raise exception 'F1 timing/pre-match state key is required';
  end if;
  if v_market.live_score_state->>'key' = p_state->>'key' then
    return;
  end if;
  if jsonb_typeof(p_probabilities) <> 'object' then
    raise exception 'F1 probabilities must be a JSON object';
  end if;

  v_count := jsonb_array_length(v_market.sport_outcomes);
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_target := (p_probabilities->>v_key)::numeric;
    if v_target is null or v_target < 0 or v_target > 1 then
      raise exception 'F1 probability is invalid for %', v_key;
    end if;
    v_sum := v_sum + v_target;
  end loop;
  if abs(v_sum - 1) > 0.000001 then
    raise exception 'F1 probabilities must sum to one';
  end if;

  if p_final then
    if v_winner = '' or not exists (select 1 from jsonb_array_elements(v_market.sport_outcomes) value where value->>'key' = v_winner) then
      raise exception 'F1 final winner is not a configured driver';
    end if;
  end if;
  v_cap := least(0.05, greatest(0.001, coalesce(p_cap, 0.05)));

  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_current := coalesce((v_market.reference_probabilities->>v_key)::numeric, 1.0 / v_count);
    if p_final then
      v_target := case when v_key = v_winner then 0.999 else 0.001 / greatest(v_count - 1, 1) end;
    else
      -- Never write a literal zero into the LMSR quantity; a verified DNF/DNS
      -- is represented by the documented floor while remaining visibly retired.
      v_target := greatest(0.000001, least(v_current + v_cap, greatest(v_current - v_cap, (p_probabilities->>v_key)::numeric)));
    end if;
    v_new := v_new || jsonb_build_object(v_key, v_target);
  end loop;

  -- Renormalize after the independent movement caps.
  v_sum := (select sum(value::numeric) from jsonb_each_text(v_new));
  v_new := (
    select jsonb_object_agg(key, value::numeric / v_sum)
    from jsonb_each_text(v_new)
  );
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    v_quantities := v_quantities || jsonb_build_object(
      v_key,
      v_market.b * ln(greatest((v_new->>v_key)::numeric, 0.000001))
    );
  end loop;

  update public.markets
     set outcome_quantities = v_quantities,
         reference_probabilities = v_new,
         live_score_state = p_state,
         updated_at = now()
   where id = v_market.id;
end;
$$;

create or replace function public.record_f1_vector_snapshot(
  p_market_id uuid,
  p_state jsonb,
  p_probabilities jsonb,
  p_reasoning text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_item jsonb;
  v_key text;
  v_sum numeric := 0;
  v_first_key text;
  v_first_probability numeric;
  v_count integer;
  v_evidence jsonb;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.market_classification <> 'live_f1' or v_market.market_type <> 'f1_race_winner' then
    raise exception 'F1 vector snapshot requires a race-winner market';
  end if;
  if p_state is null or coalesce(p_state->>'key', '') = '' or jsonb_typeof(p_probabilities) <> 'object' then
    raise exception 'F1 vector snapshot requires state and probabilities';
  end if;
  v_count := jsonb_array_length(v_market.sport_outcomes);
  for v_item in select value from jsonb_array_elements(v_market.sport_outcomes) loop
    v_key := v_item->>'key';
    if v_first_key is null then v_first_key := v_key; end if;
    if (p_probabilities->>v_key)::numeric is null then raise exception 'F1 vector is missing %', v_key; end if;
    v_sum := v_sum + (p_probabilities->>v_key)::numeric;
  end loop;
  if abs(v_sum - 1) > 0.000001 then raise exception 'F1 snapshot probabilities must sum to one'; end if;
  if exists (
    select 1 from public.market_snapshots
     where market_id = p_market_id
       and oracle_kind = 'f1_vector'
       and evidence @> jsonb_build_array(jsonb_build_object('state_key', p_state->>'key'))
  ) then
    return;
  end if;
  v_first_probability := (p_probabilities->>v_first_key)::numeric;
  v_evidence := jsonb_build_array(jsonb_build_object(
    'state_key', p_state->>'key',
    'probabilities', p_probabilities,
    'timing', p_state,
    'source_url', p_state->>'source_url'
  ));
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob, oracle_cap
  ) values (
    p_market_id, null, v_first_probability, 'f1_vector', coalesce(p_reasoning, 'Verified F1 vector'),
    array[concat('f1-vector:', p_state->>'key')], v_evidence,
    array[coalesce(p_state->>'source_provider', 'Formula 1 official timing')],
    coalesce((p_state->'previous_probabilities'->>v_first_key)::numeric, (v_market.reference_probabilities->>v_first_key)::numeric, v_first_probability),
    v_first_probability, 0.05
  );
end;
$$;

revoke all on function public.apply_f1_race_winner_oracle(uuid, jsonb, jsonb, jsonb, text, numeric, boolean, text) from public, anon, authenticated;
revoke all on function public.record_f1_vector_snapshot(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_f1_race_winner_oracle(uuid, jsonb, jsonb, jsonb, text, numeric, boolean, text) to service_role;
grant execute on function public.record_f1_vector_snapshot(uuid, jsonb, jsonb, text) to service_role;
