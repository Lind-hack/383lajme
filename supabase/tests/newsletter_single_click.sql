begin;
do $$
declare reader uuid; activated timestamptz; old_issue date := '2098-12-28';
begin
  if not activate_newsletter_subscription('single-click@example.invalid',repeat('a',64)) then raise exception 'new signup rejected'; end if;
  select id,confirmed_at into reader,activated from newsletter_subscribers where email='single-click@example.invalid';
  if not exists(select 1 from newsletter_subscribers where id=reader and status='active' and confirmed_at=now()
    and consent_version='weekly-v2-single-click' and confirm_token_hash is null) then raise exception 'signup not immediately active'; end if;
  update newsletter_subscribers set confirmed_at=now()-interval '1 day' where id=reader;
  if not activate_newsletter_subscription('single-click@example.invalid',repeat('b',64)) then raise exception 'duplicate rejected'; end if;
  if (select confirmed_at from newsletter_subscribers where id=reader)<>now()-interval '1 day' then raise exception 'duplicate reset audience cutoff'; end if;

  insert into newsletter_subscribers(email,confirm_token_hash,confirm_expires_at)
    values('still-pending@example.invalid',repeat('f',64),now()+interval '1 hour');
  if (select status from newsletter_subscribers where email='still-pending@example.invalid')<>'pending' then raise exception 'pending reader bulk activated'; end if;
  insert into newsletter_mail_queue(id,subscriber_id,confirmation_hash,payload,expires_at)
    select repeat('1',64),id,confirm_token_hash,'{}',now()+interval '1 hour' from newsletter_subscribers where email='still-pending@example.invalid';
  perform activate_newsletter_subscription('still-pending@example.invalid',repeat('c',64));
  if confirm_newsletter_subscription(repeat('f',64)) then raise exception 'old token survived direct signup'; end if;
  if (select status from newsletter_mail_queue where id=repeat('1',64))<>'cancelled' then raise exception 'old confirmation still queued'; end if;

  insert into newsletter_issues(id,cutoff,content) values(old_issue,now()-interval '1 hour','{}');
  insert into newsletter_deliveries(issue_id,subscriber_id,status,last_error) values(old_issue,reader,'held','smtp_queued');
  insert into newsletter_mail_queue(id,subscriber_id,issue_id,payload,expires_at,status)
    values(repeat('2',64),reader,old_issue,'{}',now()+interval '1 hour','held');
  perform unsubscribe_newsletter(reader);
  perform activate_newsletter_subscription('single-click@example.invalid',repeat('d',64));
  if not exists(select 1 from newsletter_subscribers where id=reader and status='active' and confirmed_at=now() and unsubscribed_at is null) then raise exception 'fresh rejoin failed'; end if;
  if (select status from newsletter_mail_queue where id=repeat('2',64))<>'cancelled' then raise exception 'rejoin revived old weekly queue'; end if;
  if (select status from newsletter_deliveries where subscriber_id=reader and issue_id=old_issue)<>'cancelled' then raise exception 'old delivery lost tombstone'; end if;

  for n in 1..5 loop
    if not activate_newsletter_subscription('single-rate-'||n||'@example.invalid',repeat('9',64)) then raise exception 'rate limit fired early'; end if;
  end loop;
  if activate_newsletter_subscription('single-rate-6@example.invalid',repeat('9',64)) then raise exception 'rate limit bypassed'; end if;
  if exists(select 1 from newsletter_subscribers where email='single-rate-6@example.invalid') then raise exception 'throttled signup activated'; end if;
  if has_function_privilege('anon','public.activate_newsletter_subscription(text,text)','execute')
    or has_function_privilege('authenticated','public.activate_newsletter_subscription(text,text)','execute') then raise exception 'public activation RPC exposed'; end if;
end $$;
rollback;
