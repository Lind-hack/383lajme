begin;
do $$
declare m uuid; outcomes jsonb; keys text[]; quantities jsonb; prices jsonb; targets jsonb; row record; count_before integer;
begin
  select jsonb_agg(jsonb_build_object('key','D'||i,'label','Driver '||i,'team','Team '||i)),array_agg('D'||i),
    jsonb_object_agg('D'||i,6500*ln(case when i=1 then .5 else .5/19 end)),
    jsonb_object_agg('D'||i,.05)
    into outcomes,keys,quantities,targets from generate_series(1,20) i;
  insert into public.markets(slug,question,category,status,market_type,market_classification,b,outcomes,sport_outcomes,outcome_quantities,reference_probabilities,live_event,closes_at)
  values('test-f1-atomic','F1 QA winner?','sport','open','f1_race_winner','live_f1',6500,keys,outcomes,quantities,targets,
    '{"provider":"formula1_dashboard","event_id":"f1-qa"}',now()+interval '1 day') returning id into m;
  perform public.apply_f1_race_winner_oracle(m,'{"key":"pre"}',targets,'[]','QA pre-race',.05,false,null);
  select reference_probabilities into prices from public.markets where id=m;
  if abs((prices->>'D1')::numeric-.45)>.000001 then raise exception 'F1 cap violated: %',prices; end if;
  if abs((select sum(value::numeric) from jsonb_each_text(prices))-1)>.000001 then raise exception 'F1 normalization failed'; end if;
  perform public.apply_f1_race_winner_oracle(m,'{"key":"final","race":{"status":"FINISHED"}}',targets,'[]','QA final',.05,true,'D1');
  select * into row from public.markets where id=m;
  if row.status<>'closed' or row.outcome<>'D1' or row.closes_at>now() or row.settlement_due_at is null then raise exception 'Final was not atomically locked'; end if;
  select count(*) into count_before from public.market_snapshots where market_id=m;
  perform public.apply_f1_race_winner_oracle(m,'{"key":"final","race":{"status":"FINISHED"}}',targets,'[]','QA duplicate',.05,true,'D1');
  if (select count(*) from public.market_snapshots where market_id=m)<>count_before then raise exception 'Duplicate final wrote another snapshot'; end if;
  if has_function_privilege('anon','public.apply_f1_race_winner_oracle(uuid,jsonb,jsonb,jsonb,text,numeric,boolean,text,jsonb)','execute')
    or has_function_privilege('authenticated','public.apply_f1_race_winner_oracle(uuid,jsonb,jsonb,jsonb,text,numeric,boolean,text,jsonb)','execute') then raise exception 'Public F1 oracle access'; end if;
  raise notice 'PASS: F1 displayed-price cap, normalization, atomic final lock, snapshot idempotency and service-only permission';
end $$;
rollback;
