begin;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  requested_at timestamptz not null default now(),
  confirm_token_hash text unique,
  confirm_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  consent_version text not null default 'weekly-v1'
);
create table public.newsletter_rate_limits (
  ip_hash text primary key,
  window_start timestamptz not null default now(),
  requests integer not null default 1
);
create table public.newsletter_issues (
  id date primary key,
  cutoff timestamptz not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create table public.newsletter_deliveries (
  issue_id date not null references public.newsletter_issues(id),
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'held')),
  claim_token uuid,
  claimed_until timestamptz,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  sent_at timestamptz,
  provider_id text,
  last_error text,
  primary key (issue_id, subscriber_id)
);
create index newsletter_delivery_pending on public.newsletter_deliveries(issue_id, next_attempt_at) where status = 'pending';

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_rate_limits enable row level security;
alter table public.newsletter_issues enable row level security;
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_subscribers, public.newsletter_rate_limits, public.newsletter_issues, public.newsletter_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.newsletter_subscribers, public.newsletter_rate_limits, public.newsletter_issues, public.newsletter_deliveries to service_role;

-- Atomic, persistent abuse limits apply across processes and serverless replicas.
create function public.request_newsletter_subscription(p_email text, p_ip_hash text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare subscriber uuid; request_count integer;
begin
  if length(p_ip_hash) <> 64 or length(p_token_hash) <> 64 or length(p_email) > 254 then
    raise exception 'Invalid subscription request';
  end if;
  delete from newsletter_rate_limits where window_start < now() - interval '2 hours';
  insert into newsletter_rate_limits(ip_hash) values(p_ip_hash)
  on conflict(ip_hash) do update set
    requests = case when newsletter_rate_limits.window_start < now() - interval '1 hour' then 1 else newsletter_rate_limits.requests + 1 end,
    window_start = case when newsletter_rate_limits.window_start < now() - interval '1 hour' then now() else newsletter_rate_limits.window_start end
  returning requests into request_count;
  if request_count > 5 then return null; end if;
  -- Expire unconfirmed requests without retaining email addresses indefinitely.
  delete from newsletter_subscribers where status = 'pending' and requested_at < now() - interval '7 days';
  insert into newsletter_subscribers(email, confirm_token_hash, confirm_expires_at)
  values(p_email, p_token_hash, now() + interval '24 hours')
  on conflict(email) do update set status = 'pending', requested_at = now(),
    confirm_token_hash = excluded.confirm_token_hash, confirm_expires_at = excluded.confirm_expires_at
  where newsletter_subscribers.status <> 'active'
    and newsletter_subscribers.requested_at < now() - interval '10 minutes'
  returning id into subscriber;
  return subscriber;
end;
$$;

create function public.confirm_newsletter_subscription(p_token_hash text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare found_id uuid;
begin
  update newsletter_subscribers set status = 'active', confirmed_at = now(), unsubscribed_at = null,
    confirm_token_hash = null, confirm_expires_at = null
  where confirm_token_hash = p_token_hash and confirm_expires_at > now() and status = 'pending'
  returning id into found_id;
  return found_id is not null;
end;
$$;

create function public.unsubscribe_newsletter(p_subscriber_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update newsletter_subscribers set status = 'unsubscribed', unsubscribed_at = now(),
    confirm_token_hash = null, confirm_expires_at = null where id = p_subscriber_id;
  update newsletter_deliveries set status = 'cancelled'
  where subscriber_id = p_subscriber_id and status = 'pending';
end;
$$;

create function public.claim_newsletter_delivery(p_issue_id date)
returns table(subscriber_id uuid, email text, claim_token uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare chosen uuid; token uuid := gen_random_uuid(); cutoff_time timestamptz;
begin
  select cutoff into cutoff_time from newsletter_issues where id = p_issue_id;
  if cutoff_time is null then return; end if;
  delete from newsletter_rate_limits where window_start < now() - interval '2 hours';
  delete from newsletter_subscribers where status = 'pending' and requested_at < now() - interval '7 days';
  update newsletter_deliveries d set status = 'held', last_error = 'issue_window_expired'
  from newsletter_issues i where i.id = d.issue_id and d.issue_id <> p_issue_id
    and i.cutoff < now() - interval '20 hours' and d.status = 'pending'
    and (d.claimed_until is null or d.claimed_until < now());
  -- A frozen issue and per-recipient primary key make overlapping runs safe.
  insert into newsletter_deliveries(issue_id, subscriber_id)
  select p_issue_id, s.id from newsletter_subscribers s
  where s.status = 'active' and s.confirmed_at <= cutoff_time
  on conflict do nothing;
  update newsletter_deliveries d set status = 'cancelled'
  where d.issue_id = p_issue_id and d.status = 'pending'
    and not exists(select 1 from newsletter_subscribers s where s.id = d.subscriber_id and s.status = 'active' and s.confirmed_at <= cutoff_time);
  -- Never retry beyond the provider's 24-hour idempotency retention.
  update newsletter_deliveries d set status = 'held', last_error = 'retry_window_expired'
  where d.issue_id = p_issue_id and d.status = 'pending'
    and (d.first_attempt_at < now() - interval '20 hours' or d.attempts >= 8)
    and (d.claimed_until is null or d.claimed_until < now());
  select d.subscriber_id into chosen from newsletter_deliveries d
  where d.issue_id = p_issue_id and d.status = 'pending' and d.next_attempt_at <= now()
    and (d.claimed_until is null or d.claimed_until < now())
  order by d.subscriber_id for update skip locked limit 1;
  if chosen is null then return; end if;
  update newsletter_deliveries d set claim_token = token, claimed_until = now() + interval '2 minutes',
    first_attempt_at = coalesce(d.first_attempt_at, now()), attempts = d.attempts + 1
  where d.issue_id = p_issue_id and d.subscriber_id = chosen;
  return query select s.id, s.email, token from newsletter_subscribers s where s.id = chosen;
end;
$$;

revoke all on function public.request_newsletter_subscription(text,text,text), public.confirm_newsletter_subscription(text), public.unsubscribe_newsletter(uuid), public.claim_newsletter_delivery(date) from public, anon, authenticated;
grant execute on function public.request_newsletter_subscription(text,text,text), public.confirm_newsletter_subscription(text), public.unsubscribe_newsletter(uuid), public.claim_newsletter_delivery(date) to service_role;
notify pgrst, 'reload schema';
commit;
