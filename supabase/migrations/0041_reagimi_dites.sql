-- Reagimi i Ditës — daily curated reaction + reader reactions.
--
-- Two tables:
--   reagimi_daily     one editor-curated reaction per calendar day (optional; the
--                     homepage falls back to an auto-pick from the day's articles)
--   reagimi_reactions one reaction per anonymous voter per day
--
-- Anonymous voter identity is the same localStorage id the daily poll already uses
-- (`383_voter_id`). No accounts, no PII.
--
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Curated reaction of the day
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reagimi_daily (
  reagimi_date  date primary key,
  quote         text        not null,
  speaker_name  text        not null,
  speaker_role  text,
  context_line  text,
  article_slug  text,
  video_url     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.reagimi_daily is
  'Editor-curated "Reagimi i Ditës". One row per day, keyed by local Kosovo date. Absent row = homepage auto-fallback.';
comment on column public.reagimi_daily.quote is
  'What was actually said. This is the lead of the card, not the article headline.';
comment on column public.reagimi_daily.video_url is
  'YouTube embed URL. NULL lets the client resolve one via /api/yt-search.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Reader reactions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reagimi_reactions (
  id           bigint generated always as identity primary key,
  reagimi_date date        not null,
  reaction     text        not null,
  voter_id     text        not null,
  created_at   timestamptz not null default now()
);

-- One reaction per person per day. The client relies on this: a duplicate insert
-- returns 23505 and the optimistic update is rolled back.
create unique index if not exists reagimi_reactions_day_voter_idx
  on public.reagimi_reactions (reagimi_date, voter_id);

-- Tally query is always "all reactions for one day".
create index if not exists reagimi_reactions_day_idx
  on public.reagimi_reactions (reagimi_date);

-- Keep the reaction vocabulary in sync with REACTIONS in lib/reagimi-data.ts.
-- Guarded so re-running the migration does not error on an existing constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reagimi_reactions_reaction_check'
  ) then
    alter table public.reagimi_reactions
      add constraint reagimi_reactions_reaction_check
      check (reaction in ('zemerim', 'dyshim', 'qesharake', 'dakord', 'shprese'));
  end if;
end $$;

-- Defensive: a voter_id is a client-generated uuid. Cap the length so a hostile
-- client cannot write unbounded rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reagimi_reactions_voter_len_check'
  ) then
    alter table public.reagimi_reactions
      add constraint reagimi_reactions_voter_len_check
      check (char_length(voter_id) between 8 and 64);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
--
-- reagimi_daily     public read; writes only via the service-role key (admin).
-- reagimi_reactions public read (needed for the live tally) + public insert.
--                   No update, no delete: a reaction is final, which is also what
--                   the UI promises.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reagimi_daily     enable row level security;
alter table public.reagimi_reactions enable row level security;

drop policy if exists reagimi_daily_public_read on public.reagimi_daily;
create policy reagimi_daily_public_read
  on public.reagimi_daily for select
  using (true);

drop policy if exists reagimi_reactions_public_read on public.reagimi_reactions;
create policy reagimi_reactions_public_read
  on public.reagimi_reactions for select
  using (true);

drop policy if exists reagimi_reactions_public_insert on public.reagimi_reactions;
create policy reagimi_reactions_public_insert
  on public.reagimi_reactions for insert
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reagimi_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists reagimi_daily_touch_updated_at on public.reagimi_daily;
create trigger reagimi_daily_touch_updated_at
  before update on public.reagimi_daily
  for each row execute function public.reagimi_touch_updated_at();
