-- Disposable PostgreSQL only; all fixture changes roll back.
begin;
insert into auth.users(id,email) values ('22222222-2222-4222-8222-222222222222','news-test@example.invalid');
do $$
declare m uuid; side text; before_coins numeric; payout_count integer;
begin
 for side in select unnest(array['PO','JO']) loop
  insert into public.markets(slug,question,category,status,market_type,market_classification,closes_at,resolution_criteria)
  values('news-settlement-'||side,'Will the official agreement be signed?','bote','open','binary','general_news',now()+interval '1 day','PO: officially signed. JO: officially rejected.') returning id into m;
  insert into public.positions(user_id,market_id,side,shares) values ('22222222-2222-4222-8222-222222222222',m,side,25);
  select coins into before_coins from public.profiles where id='22222222-2222-4222-8222-222222222222';
  perform public.apply_verified_news_settlement(m,side,'Two final original reports',array['one','two'],
   '[{"slug":"one","source":"Official A","title":"Final signed outcome","url":"https://one.example/final"},{"slug":"two","source":"Publisher B","title":"Final confirmed outcome","url":"https://two.example/final"}]',array['Official A','Publisher B']);
  if not exists(select 1 from public.markets where id=m and status='resolved' and outcome=side) then raise exception 'Market not resolved';end if;
  if (select coins from public.profiles where id='22222222-2222-4222-8222-222222222222')<>before_coins+25 then raise exception 'Incorrect winning payout';end if;
  select count(*) into payout_count from public.transactions where market_id=m and type='payout';
  begin
   perform public.apply_verified_news_settlement(m,side,'Duplicate',array['one','two'],
    '[{"slug":"one","source":"Official A","title":"Final","url":"https://one.example/final"},{"slug":"two","source":"Publisher B","title":"Final","url":"https://two.example/final"}]',array['Official A','Publisher B']);
   raise exception 'Duplicate was accepted';
  exception when others then
   if sqlerrm='Duplicate was accepted' then raise;end if;
  end;
  if (select count(*) from public.transactions where market_id=m and type='payout')<>payout_count then raise exception 'Duplicate payout';end if;
  if not exists(select 1 from public.market_snapshots where market_id=m and market_prob=case when side='PO' then 1 else 0 end) then raise exception 'Missing 0/100 chart endpoint';end if;
 end loop;
 raise notice 'PASS: PO and JO settlements, exact winnings, duplicate protection, terminal chart probabilities';
end $$;
rollback;
