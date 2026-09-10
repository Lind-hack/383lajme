begin;
do $$
declare i integer;
begin
  for i in 1..6 loop
    insert into public.markets(slug,question,category,status,market_type,market_classification,closes_at,pre_match_analysis)
    values ('quota-test-'||i,'Approval or rejection?','politike','open','binary','general_news',now()+interval '60 days',
      '{"contract_version":"news-event-v3","proposition":{"resolution_mode":"event_pair"}}');
  end loop;
  update public.markets set status='closed' where slug='quota-test-1';
  begin
    insert into public.markets(slug,question,category,status,market_type,market_classification,closes_at,pre_match_analysis)
    values ('quota-test-7','Approval or rejection?','politike','open','binary','general_news',now()+interval '60 days',
      '{"contract_version":"news-event-v3","proposition":{"resolution_mode":"event_pair"}}');
    raise exception 'TEST FAILED: seventh market was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Daily automatic news publication limit reached' then raise; end if;
  end;
  raise notice 'PASS: daily publication limit persists after closing a market';
end $$;
rollback;
