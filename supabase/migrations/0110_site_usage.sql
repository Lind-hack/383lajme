-- Anonymous, consent-gated feature counters; no account identifiers or raw IPs.
begin;
create table if not exists public.site_usage_events (
  id uuid primary key,
  visitor_hash text not null check (length(visitor_hash) = 64),
  session_hash text not null check (length(session_hash) = 64),
  path text not null check (length(path) <= 180),
  feature text not null,
  kind text not null check (kind in ('page', 'click', 'active')),
  action text,
  target_path text,
  seconds smallint not null default 0 check (seconds between 0 and 30),
  created_at timestamptz not null default now()
);
create index if not exists site_usage_time on public.site_usage_events (created_at);
create index if not exists site_usage_visitor_time on public.site_usage_events (visitor_hash, created_at);
alter table public.site_usage_events enable row level security;
revoke all on public.site_usage_events from public, anon, authenticated;
grant select, insert, delete on public.site_usage_events to service_role;

create or replace function public.record_site_usage(p_events jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 20 then
    raise exception 'Invalid usage batch';
  end if;
  if (select count(*) from site_usage_events where visitor_hash = p_events->0->>'visitor_hash'
      and created_at > now() - interval '1 hour') >= 1200 then return; end if;
  insert into site_usage_events (id, visitor_hash, session_hash, path, feature, kind, action, target_path, seconds)
  select id, visitor_hash, session_hash, path, feature, kind, action, target_path, seconds
  from jsonb_to_recordset(p_events) as e(id uuid, visitor_hash text, session_hash text, path text,
       feature text, kind text, action text, target_path text, seconds smallint)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.site_usage_summary() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  delete from site_usage_events where created_at < now() - interval '7 days';
  with events as (select * from site_usage_events where created_at >= now() - interval '24 hours'),
  features as (
    select feature, count(*) filter(where kind='page') as visits,
      count(*) filter(where kind='click') as clicks, sum(seconds) as seconds,
      count(distinct session_hash) as sessions
    from events group by feature
  ), pages as (
    select path, feature, count(*) filter(where kind='page') as visits,
      count(*) filter(where kind='click') as clicks, sum(seconds) as seconds
    from events group by path, feature
  ), buttons as (
    select feature, action, count(*) as clicks from events
    where kind='click' and action like 'button:%' group by feature, action
    order by count(*) desc limit 12
  ), destinations as (
    select target_path as path, count(*) as clicks from events
    where kind='click' and action='link' group by target_path order by count(*) desc limit 10
  )
  select jsonb_build_object('windowStart', now()-interval '24 hours', 'windowEnd', now(),
    'firstEvent', (select min(created_at) from site_usage_events),
    'features', coalesce((select jsonb_agg(f order by f.clicks desc) from features f), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(p order by p.clicks desc) from pages p), '[]'::jsonb),
    'buttons', coalesce((select jsonb_agg(b) from buttons b), '[]'::jsonb),
    'destinations', coalesce((select jsonb_agg(d) from destinations d), '[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.record_site_usage(jsonb) from public, anon, authenticated;
revoke all on function public.site_usage_summary() from public, anon, authenticated;
grant execute on function public.record_site_usage(jsonb) to service_role;
grant execute on function public.site_usage_summary() to service_role;
notify pgrst, 'reload schema';
commit;
