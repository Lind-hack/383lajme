-- 0059 - Atomic per-market evidence fingerprint guard for news repricing.
-- Apply after the application release is deployed. The application has a
-- compatibility fallback for databases that have not received this migration.

alter table public.market_snapshots
  add column if not exists evidence_fingerprint text;

create unique index if not exists market_snapshots_market_evidence_fingerprint_idx
  on public.market_snapshots (market_id, evidence_fingerprint)
  where evidence_fingerprint is not null and evidence_fingerprint <> '';

-- Keep the historical nine-argument RPC intact for rolling compatibility. This
-- overload locks the market before checking the fingerprint, then delegates to
-- the existing transactional oracle and annotates the inserted snapshot.
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
  v_snapshot_at timestamptz;
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

  select * into v_result from public.apply_news_oracle(
    p_market_id,
    p_reference_probability,
    p_oracle_reasoning,
    p_evidence_slugs,
    p_evidence,
    p_evidence_sources,
    p_last_news_at,
    p_requested_cap,
    p_evidence_kind
  );

  select max(created_at) into v_snapshot_at
    from public.market_snapshots
    where market_id = p_market_id and oracle_kind = 'news_oracle';
  if p_evidence_fingerprint is not null and trim(p_evidence_fingerprint) <> '' and v_snapshot_at is not null then
    update public.market_snapshots
      set evidence_fingerprint = trim(p_evidence_fingerprint)
      where market_id = p_market_id
        and oracle_kind = 'news_oracle'
        and created_at = v_snapshot_at
        and (evidence_fingerprint is null or evidence_fingerprint = '');
  end if;

  return query select v_result.new_price_yes, v_result.previous_price_yes, v_result.applied_cap;
end;
$$;

revoke all on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text, text) from public, anon, authenticated;
grant execute on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric, text, text) to service_role;
