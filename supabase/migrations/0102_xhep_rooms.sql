-- Kosova në xhep trip rooms: friends travelling Kosovo together, each on
-- their own phone. A room is a six-character code shared by link or QR.
-- Members are anonymous: a display name, a colour, and a summary of their
-- progress (packs opened, places stamped, paintings finished). Each device
-- keeps a secret token; only its SHA-256 is stored here. No location, photos
-- or quiz answers ever reach these tables. Service role only (the API in
-- app/api/xhep/rooms does every read and write): RLS on, no policies.

create table if not exists public.xhep_rooms (
  code text primary key check (code ~ '^[a-z0-9]{6}$'),
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.xhep_room_members (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.xhep_rooms (code) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  display_name text not null check (char_length(display_name) between 1 and 18),
  colour text not null check (colour ~ '^#[0-9a-f]{6}$'),
  progress jsonb not null default '{}'::jsonb,
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xhep_room_members_room_idx
  on public.xhep_room_members (room_code, score desc);

create table if not exists public.xhep_room_moments (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.xhep_rooms (code) on delete cascade,
  member_id uuid not null references public.xhep_room_members (id) on delete cascade,
  kind text not null check (kind in ('moment', 'pack', 'complete', 'join')),
  city_id text check (city_id is null or city_id in ('prizren', 'gjakove', 'peje', 'prishtine', 'mitrovice', 'ferizaj', 'gjilan')),
  body text not null default '' check (char_length(body) <= 140),
  created_at timestamptz not null default now()
);

create index if not exists xhep_room_moments_room_idx
  on public.xhep_room_moments (room_code, created_at desc);

create index if not exists xhep_room_moments_member_idx
  on public.xhep_room_moments (member_id, created_at desc);

alter table public.xhep_rooms enable row level security;
alter table public.xhep_room_members enable row level security;
alter table public.xhep_room_moments enable row level security;

comment on table public.xhep_rooms is
  'Kosova në xhep trip rooms (shared by link/QR). Service role only via app/api/xhep/rooms.';
comment on table public.xhep_room_members is
  'Anonymous room members: display name, colour, progress summary; token stored as SHA-256 only.';
comment on table public.xhep_room_moments is
  'A room''s feed: short moments members post, plus automatic pack-opened / painting-finished / joined events.';
