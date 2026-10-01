-- Independent publication store; no changes to news, markets or readers' accounts.
create table if not exists public.bota_coverage_articles (
 id text primary key check (id ~ '^[a-f0-9]{64}$'),
 first_seen date not null,
 data jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists bota_coverage_articles_day on public.bota_coverage_articles(first_seen);
create table if not exists public.bota_coverage_runs (
 day date primary key,
 model text not null check (model='gpt-6-luna'),
 reasoning_effort text not null check (reasoning_effort='xhigh'),
 article_count integer not null check(article_count>0),
 created_at timestamptz not null default now()
);
alter table public.bota_coverage_articles enable row level security;
alter table public.bota_coverage_runs enable row level security;
revoke all on public.bota_coverage_articles,public.bota_coverage_runs from anon, authenticated;
grant all on public.bota_coverage_articles,public.bota_coverage_runs to service_role;

create or replace function public.publish_bota_coverage(p_day date,p_articles jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
 perform pg_advisory_xact_lock(hashtext('bota_coverage_daily'));
 if exists(select 1 from bota_coverage_runs where day=p_day) then return false; end if;
 if jsonb_array_length(p_articles)<1 then raise exception 'No translated articles'; end if;
 insert into bota_coverage_articles(id,first_seen,data)
 select a->>'id',p_day,a from jsonb_array_elements(p_articles) a
 on conflict(id) do nothing;
 get diagnostics inserted_count = row_count;
 if inserted_count<1 then raise exception 'No new translated articles'; end if;
 insert into bota_coverage_runs(day,model,reasoning_effort,article_count)
 values(p_day,'gpt-6-luna','xhigh',inserted_count);
 return true;
end;$$;
revoke all on function public.publish_bota_coverage(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_bota_coverage(date,jsonb) to service_role;
