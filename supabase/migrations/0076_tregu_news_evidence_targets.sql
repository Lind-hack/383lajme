begin;

-- Targets are state, not fresh evidence. The fingerprint wrapper records a
-- target once; subsequent ticks consume elapsed time without rescoring articles.
alter table public.markets add column if not exists news_evidence_target jsonb;

create or replace function public.advance_news_evidence_target(p_market_id uuid)
returns table (new_price_yes numeric, previous_price_yes numeric, applied_cap numeric)
language plpgsql security definer set search_path = public as $$
declare
  m record; t jsonb; v_current numeric; v_cap numeric; v_elapsed numeric;
  v_target numeric; v_result record;
begin
  select * into m from public.markets where id=p_market_id for update;
  if not found or m.status <> 'open' or m.market_classification <> 'general_news'
     or m.market_type <> 'binary' or m.closes_at <= now() then return; end if;
  t := m.news_evidence_target;
  if t is null or (t->>'expires_at')::timestamptz <= now() then return; end if;
  -- An occurrence deadline takes precedence over an older evidence target.
  if m.pre_match_analysis->'proposition'->>'resolution_mode' is distinct from 'event_pair'
     and m.closes_at <= now()+interval '6 hours' then return; end if;
  v_current := public.lmsr_price_yes(m.q_yes,m.q_no,m.b);
  v_target := (t->>'probability')::numeric;
  if abs(v_target-v_current)<0.000001 then return; end if;
  v_elapsed := greatest(0,extract(epoch from now()-(t->>'applied_at')::timestamptz));
  if v_elapsed<1 then return; end if;
  v_cap := least((t->>'cap')::numeric, (t->>'cap')::numeric*v_elapsed/120);
  select * into v_result from public.apply_news_oracle(
    p_market_id,v_target,'Evidence target convergence: ' || (t->>'reasoning'),
    array(select jsonb_array_elements_text(t->'slugs')),t->'evidence',
    array(select jsonb_array_elements_text(t->'sources')),(t->>'published_at')::timestamptz,
    v_cap,'ordinary');
  update public.markets set news_evidence_target=jsonb_set(t,'{applied_at}',to_jsonb(now())) where id=p_market_id;
  return query select v_result.new_price_yes,v_result.previous_price_yes,v_result.applied_cap;
end $$;
revoke all on function public.advance_news_evidence_target(uuid) from public,anon,authenticated;
grant execute on function public.advance_news_evidence_target(uuid) to service_role;
create or replace function public.apply_news_oracle(
  p_market_id uuid,
  p_reference_probability numeric,
  p_oracle_reasoning text,
  p_evidence_slugs text[],
  p_evidence jsonb,
  p_evidence_sources text[],
  p_last_news_at timestamptz,
  p_requested_cap numeric,
  p_evidence_fingerprint text,
  p_evidence_kind text
)
returns table (new_price_yes numeric, previous_price_yes numeric, applied_cap numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_current numeric;
  v_result record;
  v_prior_snapshot_ids uuid[];
begin
  select id, q_yes, q_no, b, status into v_market
    from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then
    raise exception 'Tregu nuk është i hapur';
  end if;
  if p_evidence_fingerprint is not null and trim(p_evidence_fingerprint) <> '' then
    if exists (
      select 1 from public.market_snapshots
      where market_id = p_market_id
        and evidence_fingerprint = trim(p_evidence_fingerprint)
    ) then
      v_current := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
      return query select v_current, v_current, 0::numeric;
      return;
    end if;
  end if;

  select coalesce(array_agg(id),array[]::uuid[]) into v_prior_snapshot_ids
    from public.market_snapshots where market_id=p_market_id and created_at=now();
  select * into v_result from public.apply_news_oracle(
    p_market_id,
    p_reference_probability,
    p_oracle_reasoning,
    p_evidence_slugs,
    p_evidence,
    p_evidence_sources,
    p_last_news_at,
    least(p_requested_cap, 0.05),
    'ordinary'
  );

  if p_evidence_fingerprint is not null and trim(p_evidence_fingerprint) <> '' then
    update public.market_snapshots
      set evidence_fingerprint = trim(p_evidence_fingerprint)
      where market_id = p_market_id
        and oracle_kind = 'news_oracle'
        and created_at = now()
        and id <> all(v_prior_snapshot_ids)
        and (evidence_fingerprint is null or evidence_fingerprint = '');
  end if;

  update public.markets set news_evidence_target = jsonb_build_object(
    'probability',least(0.999,greatest(0.001,p_reference_probability)),
    'cap',v_result.applied_cap,'fingerprint',p_evidence_fingerprint,
    'reasoning',p_oracle_reasoning,'slugs',p_evidence_slugs,'evidence',p_evidence,
    'sources',p_evidence_sources,'published_at',p_last_news_at,
    'applied_at',now(),'expires_at',now()+interval '24 hours'
  ) where id=p_market_id;
  return query select v_result.new_price_yes, v_result.previous_price_yes, v_result.applied_cap;
end;
$$;

revoke all on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text, text) to service_role;

commit;
