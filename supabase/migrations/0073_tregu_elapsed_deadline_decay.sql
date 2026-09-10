-- Cadence-independent deadline targets; existing execution caps remain.
begin;
create or replace function public.apply_news_deadline_decay_window(
  p_market_id uuid,
  p_reference_probability numeric,
  p_max_move numeric
)
returns table (new_price_yes numeric, previous_price_yes numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_current numeric;
  v_target numeric;
  v_cap numeric;
  v_delta numeric;
  v_qy numeric;
  v_qn numeric;
  v_volume numeric;
  v_total_hours numeric;
  v_window_hours numeric;
  v_previous_at timestamptz;
  v_effective_at timestamptz;
  v_elapsed_target numeric;
begin
  select * into v from public.markets where id = p_market_id for update;
  if not found or v.status <> 'open' or coalesce(v.market_type, 'binary') <> 'binary'
     or lower(coalesce(v.category, '')) in ('sport', 'f1', 'football')
     or coalesce(v.market_classification, 'general_news') <> 'general_news'
     or (v.pre_match_analysis->>'contract_version' = 'news-event-v3' and v.pre_match_analysis->'proposition'->>'resolution_mode' = 'event_pair') then
    raise exception 'Ineligible deadline market';
  end if;

  v_total_hours := extract(epoch from (
    v.closes_at - coalesce(v.created_at, now() - interval '7 days')
  )) / 3600.0;
  v_window_hours := least(14 * 24.0, greatest(7 * 24.0, v_total_hours * 0.25));
  if v.closes_at <= now() or v.closes_at > now() + v_window_hours * interval '1 hour' then
    raise exception 'Market is outside horizon-based deadline decay window';
  end if;
  if p_reference_probability is null or p_reference_probability < 0 or p_reference_probability > 1 then
    raise exception 'Invalid deadline reference probability';
  end if;

  v_cap := least(0.03, greatest(0.001, coalesce(p_max_move, 0)));
  v_current := public.lmsr_price_yes(v.q_yes, v.q_no, v.b);
  -- Accumulate elapsed time, including missed polls. The movement cap limits
  -- execution, not the target; retain unconsumed time when a catch-up is capped.
  v_previous_at := coalesce((v.pre_match_analysis->>'decay_effective_at')::timestamptz, now() - interval '2 minutes');
  v_previous_at := least(now(), greatest(v_previous_at, v.closes_at - v_window_hours * interval '1 hour'));
  if v_current <= 0.05 then return query select v_current, v_current; return; end if;
  v_elapsed_target := 0.05 + (v_current - 0.05) * greatest(0, extract(epoch from (v.closes_at - now())) / nullif(extract(epoch from (v.closes_at - v_previous_at)), 0));
  v_target := greatest(v_current - v_cap, least(v_current, v_elapsed_target));
  v_effective_at := v_previous_at + (v.closes_at - v_previous_at) * ((v_current - v_target) / (v_current - 0.05))::double precision;
  v_delta := v.b * (ln(v_target / (1 - v_target)) - ln(v_current / (1 - v_current)));
  v_qy := v.q_yes + v_delta / 2;
  v_qn := v.q_no - v_delta / 2;

  update public.markets
    set q_yes = v_qy, q_no = v_qn, last_reference_at = now(), updated_at = now(),
      pre_match_analysis = coalesce(pre_match_analysis, '{}'::jsonb) || jsonb_build_object('decay_effective_at', v_effective_at)
    where id = v.id;

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = v.id and type = 'bet';
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, evidence_kind,
    market_prob_before, market_prob, oracle_cap, volume
  ) values (
    v.id, p_reference_probability, p_reference_probability, 'news_oracle',
    format('Deadline decay: elapsed-time survival adjustment within the %s-hour window; unconsumed capped time retained.', round(v_window_hours, 2)),
    array[]::text[], '{}'::jsonb, array[]::text[], 'ordinary',
    v_current, v_target, v_cap, v_volume
  );
  return query select v_target, v_current;
end;
$$;

revoke all on function public.apply_news_deadline_decay_window(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.apply_news_deadline_decay_window(uuid, numeric, numeric) to service_role;

commit;
