-- F1 vectors: row-locked movement caps, atomic final lock and persisted snapshot.
-- Replacing the 0068 signature must retain service-only execution explicitly.
create or replace function public.apply_f1_race_winner_oracle(
  p_market_id uuid, p_state jsonb, p_probabilities jsonb, p_evidence jsonb,
  p_reasoning text, p_cap numeric, p_final boolean, p_winner text,
  p_structural_keys jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  m public.markets%rowtype; k text; n integer; x numeric; target numeric;
  total numeric:=0; max_q numeric; weights numeric; cap numeric;
  fraction numeric:=1; current_prices jsonb; targets jsonb:='{}'; prices jsonb:='{}'; quantities jsonb:='{}';
begin
  select * into m from public.markets where id=p_market_id for update;
  if not found then raise exception 'F1 market not found'; end if;
  if m.live_score_state->>'key'=p_state->>'key' and m.status in ('closed','resolved') then return; end if;
  if m.status<>'open' or m.market_classification<>'live_f1' or m.market_type<>'f1_race_winner'
    or coalesce(m.live_event->>'provider','') not in ('formula1_dashboard','openf1')
    or jsonb_typeof(m.sport_outcomes)<>'array' or jsonb_array_length(m.sport_outcomes) not between 20 and 22 then
    raise exception 'Invalid F1 vector market';
  end if;
  if coalesce(p_state->>'key','')='' or jsonb_typeof(p_probabilities)<>'object' then raise exception 'F1 state and vector required'; end if;
  if m.live_score_state->>'key'=p_state->>'key' then return; end if;
  n:=jsonb_array_length(m.sport_outcomes);
  if p_final and not exists(select 1 from jsonb_array_elements(m.sport_outcomes) o where o->>'key'=p_winner) then raise exception 'Invalid final driver'; end if;
  for k in select o->>'key' from jsonb_array_elements(m.sport_outcomes) o loop
    target:=(p_probabilities->>k)::numeric;
    if target is null or target='NaN'::numeric or target<0 or target>1 then raise exception 'Invalid F1 probability'; end if;
    total:=total+target;
    targets:=targets||jsonb_build_object(k,case when p_final then case when k=p_winner then .999 else .001/(n-1) end else greatest(.000001,target) end);
  end loop;
  if abs(total-1)>.000001 then raise exception 'F1 vector must sum to one'; end if;
  select sum(value::numeric) into total from jsonb_each_text(targets);
  select jsonb_object_agg(key,value::numeric/total) into targets from jsonb_each_text(targets);
  select max(value::numeric) into max_q from jsonb_each_text(m.outcome_quantities);
  select sum(exp((value::numeric-max_q)/m.b)) into weights from jsonb_each_text(m.outcome_quantities);
  select jsonb_object_agg(key,exp((value::numeric-max_q)/m.b)/weights) into current_prices from jsonb_each_text(m.outcome_quantities);
  cap:=least(.05,greatest(.001,coalesce(p_cap,.05)));
  if not p_final then
    for k in select o->>'key' from jsonb_array_elements(m.sport_outcomes) o loop
      if current_prices->>k is null then raise exception 'Missing current F1 quantity'; end if;
      x:=abs((targets->>k)::numeric-(current_prices->>k)::numeric);
      if not (coalesce(p_structural_keys,'[]'::jsonb) ? k) and x>cap then fraction:=least(fraction,cap/x); end if;
    end loop;
  end if;
  for k in select o->>'key' from jsonb_array_elements(m.sport_outcomes) o loop
    target:=case when p_final then (targets->>k)::numeric else (current_prices->>k)::numeric+fraction*((targets->>k)::numeric-(current_prices->>k)::numeric) end;
    prices:=prices||jsonb_build_object(k,target);
    quantities:=quantities||jsonb_build_object(k,m.b*ln(greatest(.000001,target)));
  end loop;
  update public.markets set outcome_quantities=quantities,reference_probabilities=prices,live_score_state=p_state,
    status=case when p_final then 'closed' else status end,
    outcome=case when p_final then p_winner else outcome end,
    closes_at=case when p_final then least(closes_at,now()) else closes_at end,
    official_final_at=case when p_final then now() else official_final_at end,
    settlement_due_at=case when p_final then now() else settlement_due_at end,updated_at=now()
    where id=m.id;
  perform public.record_f1_vector_snapshot(m.id,p_state,prices,p_reasoning);
end $$;
revoke all on function public.apply_f1_race_winner_oracle(uuid,jsonb,jsonb,jsonb,text,numeric,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_f1_race_winner_oracle(uuid,jsonb,jsonb,jsonb,text,numeric,boolean,text,jsonb) to service_role;
