begin;

-- Manual intervention is restricted to the trusted admin API's service role.
-- The book and its snapshot change in one transaction; user ledgers do not.
create or replace function public.adjust_admin_news_odds(
  p_market_id uuid, p_delta_points numeric, p_reason text, p_source_url text
)
returns table (previous_price_yes numeric, new_price_yes numeric)
language plpgsql security definer set search_path = public as $$
declare
  m record;
  before_price numeric;
  target_price numeric;
  delta_q numeric;
  trade_volume numeric;
begin
  if p_delta_points is null or p_delta_points = 0 or abs(p_delta_points) > 98 then
    raise exception 'Ndryshimi duhet të jetë mes -98 dhe 98 pikëve, pa zero';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Kërkohet arsye konkrete për ndryshimin';
  end if;
  if coalesce(p_source_url, '') !~* '^https://[^[:space:]]+$' then
    raise exception 'Kërkohet lidhje HTTPS për lajmin ose burimin zyrtar';
  end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found or m.status <> 'open' or m.market_classification <> 'general_news'
     or m.market_type <> 'binary' or m.closes_at <= now() then
    raise exception 'Vetëm tregjet aktive binare të lajmeve mund të ndryshohen';
  end if;
  before_price := public.lmsr_price_yes(m.q_yes, m.q_no, m.b);
  target_price := before_price + p_delta_points / 100;
  if target_price < 0.01 or target_price > 0.99 then
    raise exception 'Rezultati duhet të mbetet mes 1%% dhe 99%%';
  end if;
  delta_q := m.b * (ln(target_price / (1-target_price)) - ln(before_price / (1-before_price)));
  update public.markets set
    q_yes = m.q_yes + delta_q / 2,
    q_no = m.q_no - delta_q / 2,
    news_evidence_target = null,
    last_reference_at = now(), updated_at = now()
  where id = p_market_id;
  select coalesce(sum(abs(amount)), 0) into trade_volume
    from public.transactions where market_id = p_market_id and type = 'bet';
  insert into public.market_snapshots (
    market_id, oracle_kind, oracle_reasoning, market_prob_before, market_prob,
    evidence, evidence_sources, reference_probability, volume
  ) values (
    p_market_id, 'admin_adjustment', trim(p_reason), before_price, target_price,
    jsonb_build_array(jsonb_build_object('url', p_source_url, 'reason', trim(p_reason))),
    array['Admin source'], target_price, trade_volume
  );
  return query select before_price, target_price;
end;
$$;

-- Resolution and its source audit are atomic. resolve_market owns payouts.
create or replace function public.resolve_admin_news_market(
  p_market_id uuid, p_outcome text, p_reason text, p_source_url text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  closing_price numeric;
begin
  if p_outcome not in ('PO', 'JO') then raise exception 'Rezultati duhet të jetë PO ose JO'; end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then raise exception 'Kërkohet arsye e zgjidhjes'; end if;
  if coalesce(p_source_url, '') !~* '^https://[^[:space:]]+$' then
    raise exception 'Kërkohet lidhje HTTPS për rezultatin';
  end if;
  select * into m from public.markets where id = p_market_id for update;
  if not found or m.status not in ('open', 'closed') or m.market_classification <> 'general_news'
     or m.market_type <> 'binary' then
    raise exception 'Vetëm tregjet binare të lajmeve të pazgjidhura mund të zgjidhen';
  end if;
  closing_price := public.lmsr_price_yes(m.q_yes, m.q_no, m.b);
  perform public.resolve_market(p_market_id, p_outcome);
  insert into public.market_snapshots (
    market_id, oracle_kind, oracle_reasoning, market_prob_before, market_prob, evidence
  ) values (
    p_market_id, 'admin_resolution', trim(p_reason), closing_price, closing_price,
    jsonb_build_array(jsonb_build_object('url', p_source_url, 'outcome', p_outcome, 'reason', trim(p_reason)))
  );
end;
$$;

revoke all on function public.adjust_admin_news_odds(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.adjust_admin_news_odds(uuid,numeric,text,text) to service_role;
revoke all on function public.resolve_admin_news_market(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.resolve_admin_news_market(uuid,text,text,text) to service_role;

commit;
