create table if not exists public.visit_border_wait_log (
  id bigint generated always as identity primary key,
  crossing_id text not null check (crossing_id in ('kulle', 'merdare', 'hani-i-elezit', 'vermice-morine')),
  direction text not null check (direction in ('entry', 'exit')),
  min_minutes integer not null check (min_minutes between 0 and 240),
  max_minutes integer not null check (max_minutes between 0 and 240),
  -- The normalized MPB "Updated" instant, or a snapshot hash when MPB's stamp is unreadable.
  source_key text not null,
  mpb_updated_at timestamptz,
  fetched_at timestamptz not null default now()
);

create unique index if not exists visit_border_wait_log_source_idx
  on public.visit_border_wait_log (crossing_id, direction, source_key);

create index if not exists visit_border_wait_log_recent_idx
  on public.visit_border_wait_log (fetched_at desc);

alter table public.visit_border_wait_log enable row level security;

comment on table public.visit_border_wait_log is
  'Official MPB border waits, sampled about every 10 minutes for the visitor border forecast. Service role only.';
