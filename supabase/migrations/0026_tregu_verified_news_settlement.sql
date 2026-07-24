-- 0026 — Evidence-audited settlement for binary General/News markets.
-- Apply once in Supabase SQL Editor before deploying the matching application code.

alter table public.markets
  add column if not exists resolution_evidence jsonb,
  add column if not exists resolution_evidence_slugs text[],
  add column if not exists resolution_evidence_sources text[],
  add column if not exists resolution_reasoning text,
  add column if not exists resolution_kind text;

alter table public.markets
  drop constraint if exists markets_resolution_kind_check;
alter table public.markets
  add constraint markets_resolution_kind_check
  check (resolution_kind is null or resolution_kind in ('verified_news'));

create or replace function public.apply_verified_news_settlement(
  p_market_id uuid,
  p_outcome text,
  p_oracle_reasoning text,
  p_evidence_slugs text[],
  p_evidence jsonb,
  p_evidence_sources text[]
)
returns table (outcome text, settled_at timestamptz, previous_price_yes numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market record;
  v_source_count integer;
  v_evidence_count integer;
  v_pos record;
  v_final_probability numeric;
  v_current_probability numeric;
  v_log_odds_delta numeric;
  v_new_q_yes numeric;
  v_new_q_no numeric;
  v_volume numeric;
begin
  if p_outcome not in ('PO', 'JO') then
    raise exception 'Rezultat i pavlefshëm';
  end if;

  if coalesce(cardinality(p_evidence_slugs), 0) < 2
    or coalesce(cardinality(p_evidence_sources), 0) < 2 then
    raise exception 'Zgjidhja me lajme kërkon të paktën dy prova të cituara';
  end if;

  if p_evidence is null or jsonb_typeof(p_evidence) <> 'array' then
    raise exception 'Provat e zgjidhjes duhet të jenë një listë e verifikuar';
  end if;

  select count(*) into v_evidence_count from jsonb_array_elements(p_evidence);
  if v_evidence_count <> cardinality(p_evidence_slugs) then
    raise exception 'Çdo slug i provës duhet të ketë një objekt të plotë prove';
  end if;

  if exists (
    select 1 from unnest(p_evidence_slugs) as slug
    where nullif(trim(slug), '') is null
       or (select count(*) from unnest(p_evidence_slugs) as check_slug where check_slug = slug) <> 1
       or not exists (
         select 1 from jsonb_array_elements(p_evidence) as item
         where item->>'slug' = slug
           and nullif(trim(item->>'source'), '') is not null
           and nullif(trim(item->>'title'), '') is not null
           and coalesce(item->>'url', '') ~ '^https://'
       )
  ) then
    raise exception 'Slug, titull, burim ose URL e provës nuk është i vlefshëm';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_evidence) as item
    where nullif(trim(item->>'slug'), '') is null
       or nullif(trim(item->>'source'), '') is null
       or nullif(trim(item->>'title'), '') is null
       or coalesce(item->>'url', '') !~ '^https://'
       or not ((item->>'slug') = any(p_evidence_slugs))
       or not exists (
         select 1 from unnest(p_evidence_sources) as source
         where lower(trim(source)) = lower(trim(item->>'source'))
       )
  ) then
    raise exception 'Objekti i provës nuk përputhet me slug/burim të deklaruar';
  end if;

  select count(distinct lower(trim(source))) into v_source_count
  from unnest(p_evidence_sources) as source
  where trim(source) <> '';

  if v_source_count < 2 then
    raise exception 'Zgjidhja me lajme kërkon dy burime të pavarura';
  end if;

  select * into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found or v_market.status not in ('open', 'closed') then
    raise exception 'Tregu nuk u gjet, nuk është i hapur/mbyllur, ose është zgjidhur tashmë';
  end if;

  if coalesce(v_market.market_type, 'binary') <> 'binary' then
    raise exception 'Zgjidhja me lajme mbështet vetëm tregjet binare PO/JO';
  end if;

  if coalesce(nullif(trim(v_market.resolution_criteria), ''), nullif(trim(v_market.resolution_rules), '')) is null then
    raise exception 'Tregu nuk ka kritere të qarta zgjidhjeje';
  end if;

  -- Keep LMSR shares finite internally. The resolved outcome controls the public 0%/100% result.
  v_final_probability := case when p_outcome = 'PO' then 0.99 else 0.01 end;
  v_current_probability := public.lmsr_price_yes(v_market.q_yes, v_market.q_no, v_market.b);
  v_log_odds_delta := v_market.b * (
    ln(v_final_probability / (1 - v_final_probability))
    - ln(v_current_probability / (1 - v_current_probability))
  );
  v_new_q_yes := v_market.q_yes + v_log_odds_delta / 2;
  v_new_q_no := v_market.q_no - v_log_odds_delta / 2;

  update public.markets
  set status = 'resolved',
      outcome = p_outcome,
      resolved_at = now(),
      q_yes = v_new_q_yes,
      q_no = v_new_q_no,
      resolution_evidence = p_evidence,
      resolution_evidence_slugs = p_evidence_slugs,
      resolution_evidence_sources = p_evidence_sources,
      resolution_reasoning = p_oracle_reasoning,
      resolution_kind = 'verified_news',
      updated_at = now()
  where id = p_market_id and status in ('open', 'closed');

  if not found then
    raise exception 'Tregu u zgjidh nga një proces tjetër';
  end if;

  for v_pos in
    select * from public.positions
    where market_id = p_market_id and side = p_outcome and shares > 0
  loop
    update public.profiles set coins = coins + v_pos.shares where id = v_pos.user_id;
    insert into public.transactions (user_id, type, amount, market_id, meta)
      values (v_pos.user_id, 'payout', v_pos.shares, p_market_id,
        jsonb_build_object('side', p_outcome, 'source', 'verified_news_settlement'));
  end loop;

  select coalesce(sum(abs(amount)), 0) into v_volume
  from public.transactions where market_id = p_market_id and type = 'bet';

  insert into public.market_snapshots (
    market_id, ai_prob, reference_probability, oracle_kind, oracle_reasoning,
    evidence_slugs, evidence, evidence_sources, evidence_kind, market_prob_before,
    market_prob, oracle_cap, volume
  ) values (
    p_market_id,
    case when p_outcome = 'PO' then 1 else 0 end,
    case when p_outcome = 'PO' then 1 else 0 end,
    'verified_news_settlement',
    p_oracle_reasoning,
    p_evidence_slugs,
    p_evidence,
    p_evidence_sources,
    'decisive',
    v_current_probability,
    case when p_outcome = 'PO' then 1 else 0 end,
    0.30,
    v_volume
  );

  return query select p_outcome, now(), v_current_probability;
end;
$$;

revoke all on function public.apply_verified_news_settlement(uuid, text, text, text[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.apply_verified_news_settlement(uuid, text, text, text[], jsonb, text[]) to service_role;
