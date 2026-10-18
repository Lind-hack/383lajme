-- Run only in an isolated database, or immediately after migration with an empty queue.
begin;
do $$
declare sid uuid:='00000000-0000-4000-8000-000000001112'; claim uuid:=gen_random_uuid(); job public.newsletter_mail_queue;
begin
  if exists(select 1 from newsletter_mail_queue) then raise exception 'Queue tests require an empty queue'; end if;
  if has_table_privilege('anon','public.newsletter_mail_queue','select') or has_function_privilege('authenticated','public.claim_newsletter_mail()','execute') then
    raise exception 'Queue permissions are public'; end if;
  insert into newsletter_subscribers(id,email,confirm_token_hash,confirm_expires_at)
    values(sid,'newsletter-queue-test@example.invalid',repeat('d',64),now()+interval '1 hour');
  if not enqueue_newsletter_mail(repeat('a',64),sid,'{}',now()+interval '1 hour',null,null,repeat('d',64)) then raise exception 'Confirmation enqueue failed'; end if;
  select * into job from claim_newsletter_mail();
  if job.id<>repeat('a',64) or job.status<>'sending' then raise exception 'Atomic claim failed'; end if;
  if exists(select 1 from claim_newsletter_mail()) then raise exception 'Sending job was claimed twice'; end if;
  perform finish_newsletter_mail(job.id,'pending',null,'temporary_rejection');
  if exists(select 1 from claim_newsletter_mail()) then raise exception 'Retry backoff ignored'; end if;
  update newsletter_mail_queue set next_attempt_at=now() where id=job.id;
  perform claim_newsletter_mail();
  perform finish_newsletter_mail(job.id,'sent','test-receipt');
  if not exists(select 1 from newsletter_mail_queue where id=job.id and status='sent' and provider_id='test-receipt') then raise exception 'Receipt lost'; end if;

  update newsletter_subscribers set status='active',confirmed_at=now()-interval '1 day' where id=sid;
  insert into newsletter_issues(id,cutoff,content) values('2099-12-31',now(),'{}');
  insert into newsletter_deliveries(issue_id,subscriber_id,claim_token) values('2099-12-31',sid,claim);
  perform enqueue_newsletter_mail(repeat('b',64),sid,'{}',now()+interval '1 hour','2099-12-31',claim);
  if not exists(select 1 from newsletter_deliveries where issue_id='2099-12-31' and subscriber_id=sid and status='held' and last_error='smtp_queued') then raise exception 'Queue intent not atomic'; end if;
  perform unsubscribe_newsletter(sid);
  perform claim_newsletter_mail();
  if not exists(select 1 from newsletter_mail_queue where id=repeat('b',64) and status='cancelled') then raise exception 'Revoked consent still queued'; end if;
  if not exists(select 1 from newsletter_deliveries where issue_id='2099-12-31' and subscriber_id=sid and status='cancelled') then raise exception 'Cancellation receipt missing'; end if;

  update newsletter_subscribers set status='active',confirmed_at=now()-interval '1 day' where id=sid;
  insert into newsletter_issues(id,cutoff,content) values('2099-12-30',now(),'{}');
  insert into newsletter_deliveries(issue_id,subscriber_id,claim_token) values('2099-12-30',sid,claim);
  perform enqueue_newsletter_mail(repeat('c',64),sid,'{}',now()+interval '1 hour','2099-12-30',claim);
  perform claim_newsletter_mail();
  update newsletter_mail_queue set claimed_at=now()-interval '6 minutes' where id=repeat('c',64);
  if exists(select 1 from claim_newsletter_mail()) then raise exception 'Interrupted SMTP send was reclaimed'; end if;
  if not exists(select 1 from newsletter_deliveries where issue_id='2099-12-30' and subscriber_id=sid and last_error='worker_interrupted') then raise exception 'Interrupted send not visible'; end if;
end $$;
rollback;
