begin;
do $$
declare m uuid; r record; before_count integer; before_target jsonb;
begin
 insert into public.markets(slug,question,category,status,market_type,market_classification,closes_at,pre_match_analysis)
 values('target-test','Approval or rejection?','politike','open','binary','general_news',now()+interval '60 days',
 '{"contract_version":"news-event-v3","proposition":{"resolution_mode":"event_pair"}}') returning id into m;
 select count(*) into before_count from public.transactions;
 select * into r from public.apply_news_oracle(m,0.8,'Positive direct evidence',array['one'],'[{"slug":"one"}]',array['publisher-one'],now(),0.02,'claim-one','ordinary');
 if abs(r.new_price_yes-0.52)>0.000001 then raise exception 'Single-source cap failed: %',r.new_price_yes; end if;
 select news_evidence_target into before_target from public.markets where id=m;
 perform public.apply_news_oracle(m,0.99,'Duplicate',array['one'],'[{"slug":"one"}]',array['publisher-one'],now(),0.02,'claim-one','ordinary');
 if (select news_evidence_target from public.markets where id=m) <> before_target then raise exception 'Duplicate reset target'; end if;
 perform public.advance_news_evidence_target(m);
 if abs((select public.lmsr_price_yes(q_yes,q_no,b) from public.markets where id=m)-0.52)>0.000001 then raise exception 'Same tick compounded evidence'; end if;
 update public.markets set news_evidence_target=jsonb_set(news_evidence_target,'{applied_at}',to_jsonb(now()-interval '1 minute')) where id=m;
 select * into r from public.advance_news_evidence_target(m);
 if abs(r.new_price_yes-0.53)>0.000001 then raise exception 'Elapsed convergence failed: %',r.new_price_yes; end if;
 select * into r from public.apply_news_oracle(m,0.2,'Negative direct evidence',array['two','three'],'[{"slug":"two"},{"slug":"three"}]',array['publisher-two','publisher-three'],now(),0.05,'claim-two','decisive');
 if abs(r.new_price_yes-0.48)>0.000001 then raise exception 'Negative direction/corroborated cap failed'; end if;
 update public.markets set news_evidence_target=jsonb_set(news_evidence_target,'{applied_at}',to_jsonb(now()-interval '2 minutes')) where id=m;
 select * into r from public.advance_news_evidence_target(m);
 if abs(r.new_price_yes-0.43)>0.000001 then raise exception 'Negative convergence failed'; end if;
 if (select count(*) from public.transactions) <> before_count then raise exception 'News wrote to user ledger'; end if;
 raise notice 'PASS: directional targets, caps, duplicate idempotency, elapsed convergence, no ledger writes';
end $$;
rollback;
