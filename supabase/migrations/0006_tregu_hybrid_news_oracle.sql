-- 0006 — Hybrid Tregu news oracle.
--
-- A verified Groq score can make a small, auditable LMSR state adjustment. This
-- function is deliberately the only system-adjustment boundary: it locks the
-- market, rejects closed/resolved markets, caps each move, and never touches a
-- user's profile, position, or transaction ledger.

alter table public.market_snapshots
  add column if not exists market_prob_before numeric,
  add column if not exists oracle_cap numeric,
  add column if not exists evidence_sources text[] not null default '{}';

alter table public.market_snapshots drop constraint if exists market_snapshots_market_prob_before_check;
alter table public.market_snapshots
  add constraint market_snapshots_market_prob_before_check
  check (market_prob_before is null or (market_prob_before >= 0 and market_prob_before <= 1));

alter table public.market_snapshots drop constraint if exists market_snapshots_oracle_cap_check;
alter table public.market_snapshots
  add constraint market_snapshots_oracle_cap_check
  check (oracle_cap is null or (oracle_cap > 0 and oracle_cap <= 0.05));

create or replace function public.apply_news_oracle(
  p_market_id uuid,
  p_reference_probability numeric,
  p_oracle_reasoning text,
  p_evidence_slugs text[],
  p_evidence jsonb,
  p_evidence_sources text[],
  p_last_news_at timestamptz,
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
  v_reference_probability numeric;
  v_cap numeric;
  v_oracle_delta numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_volume numeric;
  v_source_count integer;
begin
  if p_reference_probability is null or p_reference_probability < 0 or p_reference_probability > 1 then
    raise exception 'Probabiliteti i oracle duhet të jetë mes 0 dhe 1';
  end if;
  if coalesce(cardinality(p_evidence_slugs), 0) = 0 or coalesce(cardinality(p_evidence_sources), 0) = 0 then
    raise exception 'Oracle kërkon prova të verifikuara';
  end if;

  select count(distinct lower(trim(source))) into v_source_count
    from unnest(p_evidence_sources) as source
    where trim(source) <> '';
  if v_source_count = 0 then raise exception 'Oracle kërkon botues të identifikueshëm'; end if;

  -- Two percentage points is the normal cap; five needs two independent publishers.
  v_cap := least(0.05, greatest(0, coalesce(p_requested_cap, 0)));
  if v_cap = 0 then raise exception 'Oracle kërkon kufi pozitiv'; end if;
  if v_cap > 0.02 and v_source_count < 2 then
    raise exception 'Lëvizjet e mëdha të oracle kërkojnë dy burime të pavarura';
  end if;

  select * into v_market from public.markets where id = p_market_id for update;
  if not found or v_market.status <> 'open' then raise exception 'Tregu nuk është i hapur'; end if;
  if v_market.closes_at <= now() then raise exception 'Tregu është mbyllur'; end if;

  v_current_price := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_reference_probability := least(0.999, greatest(0.001, p_reference_probability));
  v_target_price := least(v_current_price + v_cap, greatest(v_current_price - v_cap, v_reference_probability));
  v_oracle_delta := v_market.b * (
    ln(v_target_price / (1 - v_target_price)) - ln(v_current_price / (1 - v_current_price))
  );
  v_new_q_yes := v_market.q_yes + v_oracle_delta / 2;
  v_new_q_no := v_market.q_no - v_oracle_delta / 2;

  update public.markets
    set q_yes = v_new_q_yes,
        q_no = v_new_q_no,
        last_news_at = p_last_news_at,
        last_reference_at = now(),
        updated_at = now()
    where id = p_market_id;

  select coalesce(sum(abs(amount)), 0) into v_volume
    from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, market_prob_before, market_prob,
    oracle_cap, volume
  ) values (
    p_market_id, p_reference_probability, p_reference_probability, 'news_oracle', p_oracle_reasoning,
    p_evidence_slugs, p_evidence, p_evidence_sources, v_current_price, v_target_price,
    v_cap, v_volume
  );

  return query select v_target_price, v_current_price, v_cap;
end;
$$;

-- Only the trusted service-role caller invokes this function; it is never exposed to browsers.
revoke all on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric) from public, anon, authenticated;
grant execute on function public.apply_news_oracle(uuid, numeric, text, text[], jsonb, text[], timestamptz, numeric) to service_role;
