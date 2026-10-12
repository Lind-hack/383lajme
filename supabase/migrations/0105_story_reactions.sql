-- Për ty — readers' reactions to single stories, with live results.
--
-- One reaction per anonymous voter per story; the voter can change it. Same
-- vocabulary and the same anonymous identity (`383_voter_id`) as Reagimi i
-- Ditës (0041). No accounts, no PII.
--
-- Only the server touches this table (app/api/per-ty/reactions, service role):
-- RLS is on with no policies, so the public anon key can neither read nor write.
--
-- Idempotent: safe to re-run.

create table if not exists public.story_reactions (
  id            bigint generated always as identity primary key,
  article_slug  text        not null,
  reaction      text        not null,
  voter_id      text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists story_reactions_slug_voter_idx
  on public.story_reactions (article_slug, voter_id);

create index if not exists story_reactions_slug_idx
  on public.story_reactions (article_slug);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'story_reactions_reaction_check') then
    alter table public.story_reactions
      add constraint story_reactions_reaction_check
      check (reaction in ('zemerim', 'dyshim', 'qesharake', 'dakord', 'shprese'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'story_reactions_voter_len_check') then
    alter table public.story_reactions
      add constraint story_reactions_voter_len_check
      check (char_length(voter_id) between 8 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'story_reactions_slug_check') then
    alter table public.story_reactions
      add constraint story_reactions_slug_check
      check (article_slug ~ '^[a-z0-9-]{1,160}$');
  end if;
end $$;

alter table public.story_reactions enable row level security;

-- The tallies the reel shows: counts per story and reaction, in one round trip.
create or replace function public.story_reaction_tallies(slugs text[])
returns table (article_slug text, reaction text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.article_slug, r.reaction, count(*)::bigint
  from public.story_reactions r
  where r.article_slug = any(slugs)
  group by r.article_slug, r.reaction
$$;

revoke all on function public.story_reaction_tallies(text[]) from public, anon, authenticated;
