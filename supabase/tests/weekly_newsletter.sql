-- Run after migration 0111. This test rolls back every fixture and mutation.
begin;
do $$
declare
  subscriber uuid; other_subscriber uuid; third_subscriber uuid; claim record; retry_claim record;
  confirmed boolean; rate_result uuid;
begin
  subscriber := public.request_newsletter_subscription('newsletter-test@example.invalid', repeat('a',64), repeat('b',64));
  if subscriber is null then raise exception 'new signup was not recorded'; end if;
  if (select status from newsletter_subscribers where id = subscriber) <> 'pending' then raise exception 'signup activated without confirmation'; end if;
  if public.request_newsletter_subscription('newsletter-test@example.invalid', repeat('a',64), repeat('c',64)) is not null then raise exception 'email cooldown bypassed'; end if;
  if public.confirm_newsletter_subscription(repeat('c',64)) then raise exception 'forged confirmation accepted'; end if;
  update newsletter_subscribers set confirm_expires_at = now() - interval '1 minute' where id = subscriber;
  if public.confirm_newsletter_subscription(repeat('b',64)) then raise exception 'expired confirmation accepted'; end if;
  update newsletter_subscribers set confirm_expires_at = now() + interval '1 hour' where id = subscriber;
  confirmed := public.confirm_newsletter_subscription(repeat('b',64));
  if not confirmed or public.confirm_newsletter_subscription(repeat('b',64)) then raise exception 'confirmation must be single-use'; end if;
  if public.request_newsletter_subscription('newsletter-test@example.invalid', repeat('a',64), repeat('c',64)) is not null then raise exception 'active subscriber was reset'; end if;

  insert into newsletter_issues(id,cutoff,content) values ('2099-01-04', now(), '{}'::jsonb);
  select * into claim from public.claim_newsletter_delivery('2099-01-04');
  if claim.subscriber_id <> subscriber then raise exception 'confirmed recipient was not claimed'; end if;
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-04')) then raise exception 'claim lease allows duplicate worker'; end if;
  update newsletter_deliveries set claimed_until = now() - interval '1 minute' where subscriber_id = subscriber;
  select * into retry_claim from public.claim_newsletter_delivery('2099-01-04');
  if retry_claim.subscriber_id <> subscriber or retry_claim.claim_token = claim.claim_token then raise exception 'expired lease did not recover with new token'; end if;
  update newsletter_deliveries set status = 'sent' where subscriber_id = subscriber;
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-04')) then raise exception 'sent delivery claimed again'; end if;
  perform public.unsubscribe_newsletter(subscriber);
  if (select status from newsletter_subscribers where id = subscriber) <> 'unsubscribed' then raise exception 'unsubscribe failed'; end if;
  -- A later edition must never revive opted-out recipients.
  insert into newsletter_issues(id,cutoff,content) values ('2099-01-11', now(), '{}'::jsonb);
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-11')) then raise exception 'unsubscribed reader received next issue'; end if;

  update newsletter_subscribers set requested_at = now() - interval '11 minutes' where id = subscriber;
  perform public.request_newsletter_subscription('newsletter-test@example.invalid', repeat('d',64), repeat('e',64));
  if (select status from newsletter_subscribers where id = subscriber) <> 'pending' then raise exception 'resubscribe skips fresh consent'; end if;
  if not public.confirm_newsletter_subscription(repeat('e',64)) then raise exception 'fresh resubscribe cannot confirm'; end if;

  other_subscriber := public.request_newsletter_subscription('newsletter-test-2@example.invalid', repeat('f',64), repeat('1',64));
  update newsletter_subscribers set status='active',confirmed_at=now() + interval '1 hour' where id=other_subscriber;
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-11') where subscriber_id=other_subscriber) then raise exception 'post-cutoff reader received old edition'; end if;
  -- The re-confirmed first subscriber is eligible; its pending send is cancelled.
  perform public.unsubscribe_newsletter(subscriber);
  if exists(select 1 from newsletter_deliveries where subscriber_id=subscriber and status='pending') then raise exception 'unsubscribe did not cancel pending deliveries'; end if;

  insert into newsletter_subscribers(email,status,confirmed_at) values('newsletter-test-3@example.invalid','active',now() - interval '1 hour') returning id into third_subscriber;
  insert into newsletter_issues(id,cutoff,content) values ('2099-01-18', now(), '{}'::jsonb);
  select * into claim from public.claim_newsletter_delivery('2099-01-18');
  if claim.subscriber_id <> third_subscriber then raise exception 'retry fixture not claimed'; end if;
  update newsletter_deliveries set first_attempt_at=now() - interval '21 hours', claimed_until=now() - interval '1 minute' where subscriber_id=third_subscriber;
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-18')) then raise exception 'delivery retried beyond idempotency window'; end if;
  if (select status from newsletter_deliveries where subscriber_id=third_subscriber and issue_id='2099-01-18') <> 'held' then raise exception 'expired delivery was not held'; end if;
  update newsletter_deliveries set status='pending', first_attempt_at=now(), attempts=8 where subscriber_id=third_subscriber;
  if exists(select 1 from public.claim_newsletter_delivery('2099-01-18')) then raise exception 'delivery exceeded retry limit'; end if;

  for n in 1..5 loop
    perform public.request_newsletter_subscription('newsletter-rate-' || n || '@example.invalid', repeat('9',64), md5(n::text) || md5(n::text));
  end loop;
  rate_result := public.request_newsletter_subscription('newsletter-rate-6@example.invalid', repeat('9',64), repeat('8',64));
  if rate_result is not null then raise exception 'persistent IP rate limit bypassed'; end if;

  if has_table_privilege('anon','public.newsletter_subscribers','select') or has_table_privilege('authenticated','public.newsletter_subscribers','select') then raise exception 'subscriber PII exposed'; end if;
  if has_function_privilege('anon','public.claim_newsletter_delivery(date)','execute') or has_function_privilege('authenticated','public.confirm_newsletter_subscription(text)','execute') then raise exception 'public RPC access exposed'; end if;
  if not has_function_privilege('service_role','public.claim_newsletter_delivery(date)','execute') then raise exception 'worker RPC unavailable'; end if;
end;
$$;
rollback;
