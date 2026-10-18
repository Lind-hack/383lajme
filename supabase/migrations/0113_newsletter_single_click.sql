begin;

-- Activation is consent from the subscribe button, not verified inbox ownership.
-- Keep confirmed_at as the existing weekly audience activation cutoff.
create function public.activate_newsletter_subscription(p_email text, p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare request_count integer; subscriber uuid;
begin
  if p_email is null or p_ip_hash is null or p_email <> lower(trim(p_email))
    or length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid subscription request';
  end if;
  delete from newsletter_rate_limits where window_start < now()-interval '2 hours';
  insert into newsletter_rate_limits(ip_hash) values(p_ip_hash)
  on conflict(ip_hash) do update set
    requests=case when newsletter_rate_limits.window_start < now()-interval '1 hour' then 1 else newsletter_rate_limits.requests+1 end,
    window_start=case when newsletter_rate_limits.window_start < now()-interval '1 hour' then now() else newsletter_rate_limits.window_start end
  returning requests into request_count;
  if request_count > 5 then return false; end if;

  insert into newsletter_subscribers(email,status,confirmed_at,consent_version)
  values(p_email,'active',now(),'weekly-v2-single-click')
  on conflict(email) do update set status='active',
    confirmed_at=case when newsletter_subscribers.status='active' then coalesce(newsletter_subscribers.confirmed_at,now()) else now() end,
    requested_at=case when newsletter_subscribers.status='active' then newsletter_subscribers.requested_at else now() end,
    unsubscribed_at=null,confirm_token_hash=null,confirm_expires_at=null,
    consent_version='weekly-v2-single-click'
  returning id into subscriber;

  -- A reader who clicks subscribe must not subsequently receive an old prompt.
  update newsletter_mail_queue set status='cancelled',last_error='activated_without_confirmation',payload='{}'::jsonb
  where subscriber_id=subscriber and issue_id is null and status in ('pending','held');
  update newsletter_mail_queue q set status='cancelled',last_error='consent_period_changed',payload='{}'::jsonb
  where q.subscriber_id=subscriber and q.issue_id is not null and q.status in ('pending','held')
    and exists(select 1 from newsletter_issues i join newsletter_subscribers s on s.id=q.subscriber_id
      where i.id=q.issue_id and s.confirmed_at>i.cutoff);
  update newsletter_deliveries d set status='cancelled',last_error='consent_period_changed'
  from newsletter_mail_queue q where q.subscriber_id=subscriber and q.issue_id=d.issue_id
    and q.subscriber_id=d.subscriber_id and q.status='cancelled' and q.last_error='consent_period_changed'
    and d.status in ('pending','held');
  return true;
end; $$;

revoke all on function public.activate_newsletter_subscription(text,text) from public,anon,authenticated;
grant execute on function public.activate_newsletter_subscription(text,text) to service_role;
create or replace function public.claim_newsletter_mail()
returns setof public.newsletter_mail_queue language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen text;
begin
  update newsletter_mail_queue set payload='{}'::jsonb where expires_at<now()-interval '7 days' and payload<>'{}'::jsonb;
  -- SMTP acceptance is not idempotent. Never reclaim an interrupted send.
  update newsletter_mail_queue set status='held',last_error='worker_interrupted'
    where status='sending' and claimed_at<now()-interval '5 minutes';
  update newsletter_mail_queue q set status='cancelled',last_error='expired_or_consent_changed'
    where q.status='pending' and (q.expires_at<=now() or not exists(
      select 1 from newsletter_subscribers s where s.id=q.subscriber_id and
      ((q.issue_id is null and s.status='pending' and s.confirm_token_hash=q.confirmation_hash and s.confirm_expires_at>now()) or
       (q.issue_id is not null and s.status='active' and exists(select 1 from newsletter_issues i where i.id=q.issue_id and s.confirmed_at<=i.cutoff)))));
  update newsletter_deliveries d set status='cancelled',last_error='expired_or_consent_changed'
    from newsletter_mail_queue q where q.issue_id=d.issue_id and q.subscriber_id=d.subscriber_id
    and q.claim_token=d.claim_token and q.status='cancelled' and d.status='held' and d.last_error='smtp_queued';
  update newsletter_mail_queue set status='held',last_error='retry_limit'
    where status='pending' and attempts>=8;
  update newsletter_deliveries d set last_error=q.last_error
    from newsletter_mail_queue q where q.issue_id=d.issue_id and q.subscriber_id=d.subscriber_id
    and q.claim_token=d.claim_token and q.status='held' and d.status='held' and d.last_error='smtp_queued';
  select id into chosen from newsletter_mail_queue where status='pending' and next_attempt_at<=now()
    order by created_at,id for update skip locked limit 1;
  if chosen is null then return; end if;
  return query update newsletter_mail_queue set status='sending',claimed_at=now(),attempts=attempts+1
    where id=chosen returning *;
end; $$;

notify pgrst,'reload schema';
commit;
