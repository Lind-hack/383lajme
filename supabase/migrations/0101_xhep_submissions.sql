-- Kosova në xhep: visitors' trip murals and stories, offered for the public
-- page. Nothing here is public. A signed-in visitor sends photos and words
-- with explicit consent (app/api/xhep/submissions); an admin approves or
-- rejects each one and decides where it goes (app/admin/xhep). Service role
-- only: RLS on, no policies, and the photo bucket is private (admins see the
-- photos through short-lived signed links).

create table if not exists public.xhep_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  city_id text not null check (city_id in ('prizren', 'gjakove', 'peje', 'prishtine', 'mitrovice', 'ferizaj', 'gjilan')),
  story text not null default '' check (char_length(story) <= 2000),
  -- Object paths in the private xhep-submissions bucket: <user>/<submission>/<n>.<ext>
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 8),
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Where an approved trip appears: the page's lead, its city, or the wall of trips.
  placement text check (placement is null or placement in ('hero', 'city', 'wall')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Something to review while pending; a rejection deletes the photos, so it is exempt.
  constraint xhep_submissions_has_content check (status <> 'pending' or cardinality(photo_paths) > 0 or char_length(story) > 0),
  constraint xhep_submissions_approved_placed check (status <> 'approved' or placement is not null)
);

create index if not exists xhep_submissions_queue_idx
  on public.xhep_submissions (status, created_at desc);

create index if not exists xhep_submissions_user_recent_idx
  on public.xhep_submissions (user_id, created_at desc);

alter table public.xhep_submissions enable row level security;

comment on table public.xhep_submissions is
  'Kosova në xhep trip murals and stories sent by signed-in visitors with consent; reviewed in /admin/xhep before anything is published. Service role only.';

insert into storage.buckets (id, name, public)
values ('xhep-submissions', 'xhep-submissions', false)
on conflict (id) do update set public = false;
