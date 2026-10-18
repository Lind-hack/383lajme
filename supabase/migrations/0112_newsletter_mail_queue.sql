begin;
create table public.newsletter_mail_queue (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  issue_id date references public.newsletter_issues(id),
  claim_token uuid,
  confirmation_hash text,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','held','failed','cancelled')),
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  expires_at timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  provider_id text,
  last_error text,
  sent_at timestamptz
);
create index newsletter_mail_due on public.newsletter_mail_queue(next_attempt_at) where status='pending';
alter table public.newsletter_mail_queue enable row level security;
revoke all on public.newsletter_mail_queue from public,anon,authenticated;
grant all on public.newsletter_mail_queue to service_role;

create function public.enqueue_newsletter_mail(p_id text,p_subscriber_id uuid,p_payload jsonb,p_expires_at timestamptz,
  p_issue_id date default null,p_claim_token uuid default null,p_confirmation_hash text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_expires_at <= now() or p_expires_at > now()+interval '25 hours' or octet_length(p_payload::text)>100000 then
    raise exception 'Invalid mail job';
  end if;
  if p_issue_id is null then
    if not exists(select 1 from newsletter_subscribers where id=p_subscriber_id and status='pending'
      and confirm_token_hash=p_confirmation_hash and confirm_expires_at>now()) then return false; end if;
  else
    update newsletter_deliveries set status='held',last_error='smtp_queued',claimed_until=null
    where issue_id=p_issue_id and subscriber_id=p_subscriber_id and claim_token=p_claim_token and status='pending';
    if not found then return false; end if;
  end if;
  insert into newsletter_mail_queue(id,subscriber_id,issue_id,claim_token,confirmation_hash,payload,expires_at)
    values(p_id,p_subscriber_id,p_issue_id,p_claim_token,p_confirmation_hash,p_payload,p_expires_at)
    on conflict(id) do nothing;
  return true;
end; $$;

create function public.claim_newsletter_mail()
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
       (q.issue_id is not null and s.status='active'))));
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

create function public.finish_newsletter_mail(p_id text,p_status text,p_provider_id text default null,p_error text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job newsletter_mail_queue;
begin
  if p_status not in ('sent','pending','held','failed','cancelled') then raise exception 'Invalid mail result'; end if;
  update newsletter_mail_queue set status=p_status,provider_id=p_provider_id,last_error=p_error,
    sent_at=case when p_status='sent' then now() else sent_at end,next_attempt_at=now()+interval '5 minutes'
    where id=p_id and status='sending' returning * into job;
  if not found then return; end if;
  if job.issue_id is not null then
    update newsletter_deliveries set status=case when p_status='sent' then 'sent' when p_status='cancelled' then 'cancelled' else 'held' end,
      provider_id=p_provider_id,sent_at=case when p_status='sent' then now() else sent_at end,
      last_error=case when p_status='pending' then 'smtp_queued' else p_error end,claimed_until=null
      where issue_id=job.issue_id and subscriber_id=job.subscriber_id and claim_token=job.claim_token;
  elsif p_status='failed' then
    update newsletter_subscribers set requested_at=now()-interval '11 minutes',confirm_token_hash=null,confirm_expires_at=null
      where id=job.subscriber_id and status='pending' and confirm_token_hash=job.confirmation_hash;
  end if;
end; $$;

revoke all on function public.enqueue_newsletter_mail(text,uuid,jsonb,timestamptz,date,uuid,text),public.claim_newsletter_mail(),public.finish_newsletter_mail(text,text,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_newsletter_mail(text,uuid,jsonb,timestamptz,date,uuid,text),public.claim_newsletter_mail(),public.finish_newsletter_mail(text,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
