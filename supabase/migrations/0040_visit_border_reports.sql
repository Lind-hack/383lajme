create table if not exists public.visit_border_reports (
  id uuid primary key default gen_random_uuid(),
  crossing_id text not null check (crossing_id in ('kulle', 'merdare', 'hani-i-elezit', 'vermice-morine')),
  direction text not null check (direction in ('entry', 'exit')),
  wait_minutes integer not null check (wait_minutes between 0 and 240),
  status text not null check (status in ('accepted', 'quarantined')),
  confidence text not null check (confidence in ('low', 'medium', 'high', 'rejected_outlier')),
  geofence_verified boolean not null default false,
  distance_bucket_m integer not null,
  accuracy_bucket_m integer not null,
  official_minutes integer,
  device_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists visit_border_reports_recent_idx
  on public.visit_border_reports (crossing_id, direction, created_at desc)
  where status = 'accepted';

create index if not exists visit_border_reports_device_idx
  on public.visit_border_reports (device_hash, created_at desc);

alter table public.visit_border_reports enable row level security;

comment on table public.visit_border_reports is
  'Geofenced community border estimates. Exact coordinates and raw IP addresses are never stored.';
