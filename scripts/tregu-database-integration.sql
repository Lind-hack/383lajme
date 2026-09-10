-- Run only against the disposable test database after all migrations.
begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','test@example.invalid');
update public.profiles set coins=10000 where id='11111111-1111-4111-8111-111111111111';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare m uuid; book record; coins_before numeric; coins_after numeric; count_before integer; response jsonb;
begin
  for book in select * from (values ('nba','espn'),('fbk.kosovo','fbk')) as t(league,provider) loop
    insert into public.markets(slug,question,category,status,market_type,market_classification,b,outcomes,sport_outcomes,outcome_quantities,reference_probabilities,live_event,closes_at)
    values ('test-'||book.league,'Home versus away?', 'sport','open','two_outcome','live_basketball',6500,array['home','away'],
      '[{"key":"home","label":"Home","team":"Home"},{"key":"away","label":"Away","team":"Away"}]',
      '{"home":0,"away":0}','{"home":0.5,"away":0.5}',
      jsonb_build_object('provider',book.provider,'event_id','test-event','league',book.league,'yes_team','Home','home_team','Home','away_team','Away'),now()+interval '1 day') returning id into m;
    execute 'set local role authenticated';
    perform public.place_sport_market_bet(m,'home',100);
    execute 'reset role';
    select coins into coins_before from public.profiles where id=auth.uid();
    if coins_before <> 9900 then raise exception 'Buy balance mismatch'; end if;
    execute 'set local role authenticated';
    response := public.sell_market_coins(m,'home',25,false,false);
    execute 'reset role';
    select coins into coins_after from public.profiles where id=auth.uid();
    if abs(coins_after-coins_before-25)>0.000001 then raise exception 'Sell balance mismatch'; end if;
    perform public.apply_sport_market_oracle(m,book.provider,'test-event',
      '{"key":"final-test","status":"STATUS_FINAL","source_url":"https://www.basketbolli.com/Results?leagueId=150"}',
      '{"home":0.999999,"away":0.000001}','[]','Verified test final',0.1,true,'home',now());
    select count(*) into count_before from public.transactions where market_id=m and type='payout';
    perform public.settle_due_sport_markets();
    if (select count(*) from public.transactions where market_id=m and type='payout') <> count_before+1 then raise exception 'Missing payout'; end if;
    perform public.settle_due_sport_markets();
    if (select count(*) from public.transactions where market_id=m and type='payout') <> count_before+1 then raise exception 'Duplicate payout'; end if;
    update public.profiles set coins=10000 where id=auth.uid();
  end loop;
  insert into public.markets(slug,question,category,status,market_type,market_classification,closes_at,pre_match_analysis)
  values ('test-event-review','Approval or rejection?','politike','open','binary','general_news',now()-interval '1 hour',
    '{"contract_version":"news-event-v3","proposition":{"resolution_mode":"event_pair"}}') returning id into m;
  perform public.pause_due_news_event_markets();
  if not exists(select 1 from public.markets where id=m and status='stale' and outcome is null) then raise exception 'Review assigned result or did not pause'; end if;
  raise notice 'PASS: authenticated NBA/FBK buy, partial coin sell, final lock, exactly-once payout, event review without result';
end;
$$;
rollback;
