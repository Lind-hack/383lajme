begin;
do $$ begin
 if has_table_privilege('anon','public.site_smtp_mail_queue','SELECT') or has_table_privilege('authenticated','public.site_smtp_mail_queue','INSERT') then raise exception 'Queue exposed'; end if;
 if has_function_privilege('anon','public.claim_site_smtp_mail()','EXECUTE') or has_function_privilege('authenticated','public.finish_site_smtp_mail(text,text,text)','EXECUTE') then raise exception 'RPC exposed'; end if;
end $$;
insert into site_smtp_mail_queue(id,payload) values('operator-integration-test','{"ciphertext":"test"}'::jsonb) on conflict(id) do nothing;
insert into site_smtp_mail_queue(id,payload) values('operator-integration-test','{"ciphertext":"duplicate"}'::jsonb) on conflict(id) do nothing;
do $$ declare job site_smtp_mail_queue; begin
 if (select count(*) from site_smtp_mail_queue where id='operator-integration-test')<>1 then raise exception 'Duplicate queue id'; end if;
 select * into job from claim_site_smtp_mail();
 if job.id is distinct from 'operator-integration-test' or job.status<>'sending' then raise exception 'Claim failed'; end if;
 perform finish_site_smtp_mail(job.id,'sent');
 if not exists(select 1 from site_smtp_mail_queue where id=job.id and status='sent' and sent_at is not null) then raise exception 'Receipt failed'; end if;
end $$;
rollback;
