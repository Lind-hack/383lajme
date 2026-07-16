-- 0013 — Source-backed England–Argentina pre-match refresh audit.
-- This path changes only the virtual sport market's bounded LMSR reference and
-- audit metadata. It never writes profiles, positions, or transactions.

alter table public.market_automation_runs
  drop constraint if exists market_automation_runs_action_check;

alter table public.market_automation_runs
  add constraint market_automation_runs_action_check
  check (action in ('daily_drafts', 'reprice', 'live_sports', 'pre_match_refresh'));

create or replace function public.record_pre_match_market_scan(
  p_market_id uuid,
  p_health jsonb,
  p_scan jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_market record;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.slug <> 'england-argentina-full-time-result-20260715'
    or v_market.live_event->>'provider' <> 'espn' or v_market.live_event->>'event_id' <> '760515' then
    raise exception 'Open England–Argentina ESPN market is required';
  end if;
  update public.markets
  set pre_match_analysis = coalesce(v_market.pre_match_analysis, '{}'::jsonb)
      || jsonb_build_object('refresh_health', p_health, 'last_pre_match_scan', p_scan),
      updated_at = now()
  where id = p_market_id;
end;
$$;
revoke all on function public.record_pre_match_market_scan(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_pre_match_market_scan(uuid, jsonb, jsonb) to service_role;

create or replace function public.apply_pre_match_three_outcome_reference(
  p_market_id uuid,
  p_reference_probabilities jsonb,
  p_evidence jsonb,
  p_reasoning text,
  p_requested_cap numeric,
  p_health jsonb,
  p_scan jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_market record; v_key text; v_sum numeric := 0; v_current jsonb; v_target jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb; v_probability numeric; v_cap numeric;
begin
  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' or v_market.slug <> 'england-argentina-full-time-result-20260715'
    or v_market.market_type <> 'three_outcome' or v_market.live_event->>'provider' <> 'espn'
    or v_market.live_event->>'event_id' <> '760515' then
    raise exception 'Open England–Argentina ESPN three-outcome market is required';
  end if;
  if jsonb_array_length(coalesce(p_evidence, '[]'::jsonb)) < 2 then raise exception 'Two cited sources are required'; end if;
  v_cap := least(0.05, greatest(0.001, p_requested_cap));
  v_current := coalesce(v_market.reference_probabilities, public.lmsr_three_outcome_prices(v_market.q_england, v_market.q_draw, v_market.q_argentina, v_market.b));
  foreach v_key in array array['england', 'draw', 'argentina'] loop
    v_probability := (p_reference_probabilities->>v_key)::numeric;
    if v_probability is null or v_probability <= 0 or v_probability >= 1 then raise exception 'Three-way probabilities must be between zero and one'; end if;
    v_sum := v_sum + v_probability;
  end loop;
  if abs(v_sum - 1) > 0.000001 then raise exception 'Three-way probabilities must sum to one'; end if;
  foreach v_key in array array['england', 'draw', 'argentina'] loop
    v_probability := least((v_current->>v_key)::numeric + v_cap, greatest((v_current->>v_key)::numeric - v_cap, (p_reference_probabilities->>v_key)::numeric));
    v_target := v_target || jsonb_build_object(v_key, v_probability);
  end loop;
  foreach v_key in array array['england', 'draw', 'argentina'] loop
    v_new := v_new || jsonb_build_object(v_key, (v_target->>v_key)::numeric / (select sum(value::numeric) from jsonb_each_text(v_target)));
  end loop;
  update public.markets
  set q_england = b * ln((v_new->>'england')::numeric),
      q_draw = b * ln((v_new->>'draw')::numeric),
      q_argentina = b * ln((v_new->>'argentina')::numeric),
      outcome_quantities = jsonb_build_object('england', b * ln((v_new->>'england')::numeric), 'draw', b * ln((v_new->>'draw')::numeric), 'argentina', b * ln((v_new->>'argentina')::numeric)),
      reference_probabilities = v_new,
      pre_match_analysis = coalesce(v_market.pre_match_analysis, '{}'::jsonb)
        || jsonb_build_object('refresh_health', p_health, 'last_pre_match_scan', p_scan),
      updated_at = now()
  where id = p_market_id;
  insert into public.market_snapshots (market_id, oracle_kind, market_prob, reference_probability, oracle_cap, evidence, oracle_reasoning)
  values (p_market_id, 'pre_match_groq', (v_new->>'england')::numeric, (p_reference_probabilities->>'england')::numeric, v_cap, p_evidence, p_reasoning);
end;
$$;
revoke all on function public.apply_pre_match_three_outcome_reference(uuid, jsonb, jsonb, text, numeric, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_pre_match_three_outcome_reference(uuid, jsonb, jsonb, text, numeric, jsonb, jsonb) to service_role;
