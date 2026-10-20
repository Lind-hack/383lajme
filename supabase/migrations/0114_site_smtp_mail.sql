begin;
-- Operator mail sent by Railway is encrypted here, then delivered by the private SMTP worker.
create table public.site_smtp_mail_queue (
 id text primary key,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','held','failed')),
 attempts integer not null default 0,
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 next_attempt_at timestamptz not null default now(),
 sent_at timestamptz,
 last_error text
);
alter table public.site_smtp_mail_queue enable row level security;
revoke all on public.site_smtp_mail_queue from public, anon, authenticated;
grant all on public.site_smtp_mail_queue to service_role;
create function public.claim_site_smtp_mail() returns setof public.site_smtp_mail_queue
 language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen text;
begin
 update site_smtp_mail_queue set payload='{}'::jsonb where created_at<now()-interval '7 days' and status in ('sent','failed');
 -- SMTP acceptance is uncertain after interruption. Never retry those jobs automatically.
 update site_smtp_mail_queue set status='held',last_error='worker_interrupted'
  where status='sending' and claimed_at<now()-interval '5 minutes';
 update site_smtp_mail_queue set status='failed',last_error='retry_limit_or_expired'
  where status='pending' and (attempts>=8 or created_at<now()-interval '1 day');
 select id into chosen from site_smtp_mail_queue where status='pending' and next_attempt_at<=now()
  order by created_at,id for update skip locked limit 1;
 if chosen is null then return; end if;
 return query update site_smtp_mail_queue set status='sending',claimed_at=now(),attempts=attempts+1
  where id=chosen returning *;
end; $$;
create function public.finish_site_smtp_mail(p_id text,p_status text,p_error text default null) returns void
 language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_status not in ('sent','pending','held','failed') then raise exception 'Invalid mail status'; end if;
 update site_smtp_mail_queue set status=p_status,last_error=p_error,next_attempt_at=now()+interval '5 minutes',
  sent_at=case when p_status='sent' then now() else sent_at end
  where id=p_id and status='sending';
end; $$;
revoke all on function public.claim_site_smtp_mail(),public.finish_site_smtp_mail(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_site_smtp_mail(),public.finish_site_smtp_mail(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
