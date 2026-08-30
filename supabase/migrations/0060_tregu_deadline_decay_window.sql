-- 0060 - Gradual, auditable deadline decay during the final 72 hours.
-- The application falls back to the existing final-24-hour RPC only while this
-- migration is pending. Do not replace this with a direct table update.

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
begin
  select * into v from public.markets where id = p_market_id for update;
  if not found or v.status <> 'open' or coalesce(v.market_type, 'binary') <> 'binary'
     or lower(coalesce(v.category, '')) in ('sport', 'f1', 'football')
     or coalesce(v.market_classification, 'general_news') <> 'general_news' then
    raise exception 'Ineligible deadline market';
  end if;
  if v.closes_at <= now() or v.closes_at > now() + interval '72 hours' then
    raise exception 'Market is outside deadline decay window';
  end if;
  if p_reference_probability is null or p_reference_probability < 0 or p_reference_probability > 1 then
    raise exception 'Invalid deadline reference probability';
  end if;
  v_cap := least(0.03, greatest(0.001, coalesce(p_max_move, 0)));
  v_current := public.lmsr_price_yes(v.q_yes, v.q_no, v.b);
  v_target := greatest(v_current - v_cap, least(v_current, greatest(0.01, least(0.05, p_reference_probability))));
  v_delta := v.b * (ln(v_target / (1 - v_target)) - ln(v_current / (1 - v_current)));
  v_qy := v.q_yes + v_delta / 2;
  v_qn := v.q_no - v_delta / 2;

  update public.markets
    set q_yes = v_qy, q_no = v_qn, last_reference_at = now(), updated_at = now()
    where id = v.id;

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = v.id and type = 'bet';
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, evidence_kind,
    market_prob_before, market_prob, oracle_cap, volume
  ) values (
    v.id, p_reference_probability, p_reference_probability, 'news_oracle',
    'Deadline decay: no qualifying imminent evidence before stated expiry.',
    array[]::text[], '[]'::jsonb, array[]::text[], 'ordinary',
    v_current, v_target, v_cap, v_volume
  );
  return query select v_target, v_current;
end;
$$;

revoke all on function public.apply_news_deadline_decay_window(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.apply_news_deadline_decay_window(uuid, numeric, numeric) to service_role;
