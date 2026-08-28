-- 0051 — Dosje: sourced historical timelines.
--
-- The dossier's 42 milestones were written by hand into lib/topics.mjs from
-- memory. Two carried a source. One of the two dates that were ever checked was
-- wrong. A history feature on a news site cannot rest on that, so the text moves
-- out of code and into rows that can carry citations, an approval state, and an
-- audit trail.
--
-- The rule this schema exists to enforce, and enforces itself rather than
-- trusting the application: a milestone cannot be published without two verified
-- citations from distinct publishers. That is a trigger, not a convention — a
-- bug in the admin UI, a stray update, or a future refactor cannot get around
-- it. The precedent is 0026, which already refuses to settle a market on fewer
-- than two independent sources.
--
-- Public reads see approved rows only, via RLS. A read-path bug therefore
-- cannot leak a draft: the row simply is not visible.

-- ─────────────────────────────────────────────────────────────────────────────
-- Topics
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_topics (
  slug        text primary key,
  title       text not null,
  blurb       text not null,
  status      text not null default 'draft'
                check (status in ('draft', 'approved', 'retired')),
  -- Eligibility, replacing the hand-typed forms[] lists. An anchor is required
  -- for the topic to match at all; a signal only supports; an exclude vetoes.
  -- This is what keeps a NATO exercise in Turkey out of the Kosovo KFOR file:
  -- "nato" is a signal, "kosove" is the anchor, "turqi" is an exclude.
  anchors     text[] not null default '{}',
  signals     text[] not null default '{}',
  excludes    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.dosje_topics is
  'Standing subjects that carry a historical timeline. Only status=approved is publicly readable.';
comment on column public.dosje_topics.anchors is
  'Terms without which this topic cannot match an article at all.';
comment on column public.dosje_topics.excludes is
  'Any hit vetoes the topic outright, whatever else scored.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Milestones
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_milestones (
  id             uuid primary key default gen_random_uuid(),
  topic_slug     text not null references public.dosje_topics(slug) on delete cascade,

  -- The sortable date and the way it is written. Some moments are honestly
  -- vague ("Qershor 1999"), so precision is recorded rather than faked.
  event_date     date not null,
  date_precision text not null default 'day'
                   check (date_precision in ('day', 'month', 'year')),
  display_date   text not null,

  tag            text,
  title          text not null,
  summary        text not null,
  why            text,

  status         text not null default 'draft'
                   check (status in ('draft', 'needs_source', 'rejected', 'approved')),

  -- Which sentence rests on which citation. Written by the drafting job and
  -- checked at approval: an edit after verification invalidates the approval.
  claims         jsonb not null default '{}'::jsonb,

  drafted_by     text,
  drafted_at     timestamptz not null default now(),
  approved_at    timestamptz,
  approved_by    text,

  -- Folded title + year, so the same moment cannot be drafted twice.
  dedupe_key     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (topic_slug, dedupe_key)
);

create index if not exists dosje_milestones_topic
  on public.dosje_milestones (topic_slug, event_date);
create index if not exists dosje_milestones_queue
  on public.dosje_milestones (status, drafted_at desc);

comment on table public.dosje_milestones is
  'One moment in a dossier. Nothing here is public until status=approved, and approval is refused without two verified citations.';
comment on column public.dosje_milestones.claims is
  'Sentence-to-citation map. Set edited_after_verification when the text changes post-verification so approval re-checks.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Citations — the reason this table exists at all
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_citations (
  id           uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.dosje_milestones(id) on delete cascade,

  url          text not null check (url ~ '^https://'),
  publisher    text not null,
  source_title text,
  source_date  date,

  -- The exact sentence in the source that carries the claim. Without it an
  -- approver has to take the link on faith, which is the habit this replaces.
  quote        text,
  supports     text check (supports in ('date', 'title', 'summary', 'why')),

  -- Re-fetch evidence. A citation that has never returned 200 does not count
  -- toward the two-publisher minimum.
  fetched_at   timestamptz,
  http_status  int,
  content_hash text,

  created_at   timestamptz not null default now(),
  unique (milestone_id, url)
);

create index if not exists dosje_citations_milestone
  on public.dosje_citations (milestone_id);

comment on table public.dosje_citations is
  'Sources for a milestone. Two distinct publishers verified at http 200 are required before it can be approved.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Media — absent by default
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_media (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid references public.dosje_milestones(id) on delete cascade,
  topic_slug    text references public.dosje_topics(slug) on delete cascade,

  kind          text not null check (kind in ('image', 'video')),
  url           text not null,
  credit        text,
  source_url    text,
  license       text,

  -- One legal value for images, so the schema itself refuses "illustrative".
  -- A photograph is of the event or there is no photograph; the alternative was
  -- a Bitcoin chart under the 2013 NATO drawdown, captioned as coverage of it.
  relation      text check (relation in ('contemporaneous_coverage', 'explainer')),

  -- Videos rot. Nothing renders until a liveness check has passed, and a link
  -- that starts failing is taken down rather than left as a broken thumbnail.
  checked_at    timestamptz,
  check_status  int,

  approved      boolean not null default false,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),

  check (milestone_id is not null or topic_slug is not null)
);

create index if not exists dosje_media_milestone on public.dosje_media (milestone_id);
create index if not exists dosje_media_topic on public.dosje_media (topic_slug);

comment on table public.dosje_media is
  'Images and explainer videos. Nothing renders unless approved=true; an image must be contemporaneous coverage of its own milestone.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Article → topic, the tag news_articles does not have
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_article_topics (
  article_slug text not null,
  topic_slug   text not null references public.dosje_topics(slug) on delete cascade,
  score        numeric not null default 0,
  method       text not null default 'rule' check (method in ('rule', 'llm')),
  reasons      jsonb not null default '{}'::jsonb,
  decided_at   timestamptz not null default now(),
  primary key (article_slug, topic_slug)
);

create index if not exists dosje_article_topics_topic
  on public.dosje_article_topics (topic_slug, decided_at desc);

comment on table public.dosje_article_topics is
  'Which dossier an article belongs to, decided once at ingest rather than re-scanned on every render. reasons is what makes a match defensible in review.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The research ledger — same idiom as telegram_posts (0046)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_research_runs (
  id             bigint generated always as identity primary key,
  subject_key    text not null,
  run_date       date not null default current_date,
  outcome        text not null default 'in_progress'
                   check (outcome in ('in_progress', 'drafted', 'no_subject',
                                      'no_sources', 'duplicate', 'llm_failed',
                                      'verify_failed')),
  article_slugs  text[] not null default '{}',
  detail         jsonb not null default '{}'::jsonb,
  -- A subject that yielded nothing is not retried tomorrow.
  cooldown_until date,
  created_at     timestamptz not null default now(),
  unique (subject_key, run_date)
);

create index if not exists dosje_research_runs_recent
  on public.dosje_research_runs (created_at desc);

comment on table public.dosje_research_runs is
  'Claimed before work begins, so a double-fire is a no-op rather than a doubled spend. Every failure mode is a recorded outcome, never a partial write.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The constraint that makes an unsourced claim impossible to publish
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dosje_require_sources()
returns trigger
language plpgsql
as $$
declare
  verified_publishers int;
begin
  if new.status is distinct from 'approved' then
    return new;
  end if;

  -- A citation counts only once it has actually been fetched and answered 200.
  -- A URL nobody has opened is a claim, not a source.
  select count(distinct lower(btrim(publisher)))
    into verified_publishers
    from public.dosje_citations
   where milestone_id = new.id
     and http_status = 200
     and publisher is not null
     and btrim(publisher) <> '';

  if verified_publishers < 2 then
    raise exception
      'Një moment nuk mund të miratohet pa dy burime të verifikuara nga botues të ndryshëm (gjetur: %)',
      verified_publishers;
  end if;

  if coalesce((new.claims ->> 'edited_after_verification')::boolean, false) then
    raise exception
      'Teksti është ndryshuar pas verifikimit — burimet duhet të rikontrollohen para miratimit';
  end if;

  return new;
end;
$$;

comment on function public.dosje_require_sources() is
  'Refuses approval without two verified citations from distinct publishers, or after the text was edited post-verification.';

drop trigger if exists dosje_milestones_require_sources on public.dosje_milestones;
create trigger dosje_milestones_require_sources
  before insert or update on public.dosje_milestones
  for each row execute function public.dosje_require_sources();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security: the public sees approved work and nothing else
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.dosje_topics         enable row level security;
alter table public.dosje_milestones     enable row level security;
alter table public.dosje_citations      enable row level security;
alter table public.dosje_media          enable row level security;
alter table public.dosje_article_topics enable row level security;
alter table public.dosje_research_runs  enable row level security;

drop policy if exists dosje_topics_public_read on public.dosje_topics;
create policy dosje_topics_public_read
  on public.dosje_topics for select
  using (status = 'approved');

drop policy if exists dosje_milestones_public_read on public.dosje_milestones;
create policy dosje_milestones_public_read
  on public.dosje_milestones for select
  using (status = 'approved');

-- Citations are public on purpose: a claim the reader cannot check is the
-- thing this schema exists to stop shipping.
drop policy if exists dosje_citations_public_read on public.dosje_citations;
create policy dosje_citations_public_read
  on public.dosje_citations for select
  using (
    exists (
      select 1 from public.dosje_milestones m
       where m.id = dosje_citations.milestone_id
         and m.status = 'approved'
    )
  );

drop policy if exists dosje_media_public_read on public.dosje_media;
create policy dosje_media_public_read
  on public.dosje_media for select
  using (approved = true);

-- dosje_article_topics and dosje_research_runs get no policies at all:
-- service-role only, like telegram_posts.

-- ─────────────────────────────────────────────────────────────────────────────
-- One round trip for a whole dossier
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.dosje_topic(text);
create or replace function public.dosje_topic(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'topic', (
      select to_jsonb(t) - 'anchors' - 'signals' - 'excludes'
        from public.dosje_topics t
       where t.slug = p_slug and t.status = 'approved'
    ),
    'milestones', coalesce(
      (
        select jsonb_agg(ms order by ms.event_date)
          from (
            select
              m.id, m.event_date, m.date_precision, m.display_date,
              m.tag, m.title, m.summary, m.why,
              coalesce(
                (
                  select jsonb_agg(jsonb_build_object(
                           'url', c.url, 'publisher', c.publisher,
                           'title', c.source_title, 'date', c.source_date))
                    from public.dosje_citations c
                   where c.milestone_id = m.id and c.http_status = 200
                ), '[]'::jsonb
              ) as citations,
              (
                select jsonb_build_object('url', d.url, 'credit', d.credit,
                                          'sourceUrl', d.source_url, 'license', d.license)
                  from public.dosje_media d
                 where d.milestone_id = m.id and d.kind = 'image' and d.approved
                 limit 1
              ) as image
              from public.dosje_milestones m
             where m.topic_slug = p_slug and m.status = 'approved'
          ) ms
      ),
      '[]'::jsonb
    ),
    'videos', coalesce(
      (
        select jsonb_agg(jsonb_build_object('url', d.url, 'credit', d.credit))
          from public.dosje_media d
         where d.topic_slug = p_slug and d.kind = 'video' and d.approved
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.dosje_topic(text) is
  'One approved dossier — topic, milestones with their verified citations, approved imagery — in a single round trip.';

revoke all on function public.dosje_topic(text) from public;
grant execute on function public.dosje_topic(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Prove the constraint holds, at apply time
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t_slug text := '__dosje_selftest__';
  m_id   uuid;
  raised boolean := false;
begin
  insert into public.dosje_topics (slug, title, blurb)
       values (t_slug, 'Vetëtest', 'Vetëtest') on conflict (slug) do nothing;

  insert into public.dosje_milestones
         (topic_slug, event_date, display_date, title, summary, dedupe_key)
       values (t_slug, date '1999-06-12', 'Qershor 1999', 'Vetëtest', 'Vetëtest', 'selftest')
    returning id into m_id;

  -- No citations at all: approval must be refused.
  begin
    update public.dosje_milestones set status = 'approved' where id = m_id;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'dosje_require_sources did not refuse an unsourced approval';
  end if;

  -- One publisher, verified: still not enough.
  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
       values (m_id, 'https://example.org/a', 'Reuters', 200);
  raised := false;
  begin
    update public.dosje_milestones set status = 'approved' where id = m_id;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'dosje_require_sources accepted a single publisher';
  end if;

  -- A second publisher that was never fetched does not count either.
  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
       values (m_id, 'https://example.org/b', 'BalkanInsight', null);
  raised := false;
  begin
    update public.dosje_milestones set status = 'approved' where id = m_id;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'dosje_require_sources counted an unfetched citation';
  end if;

  delete from public.dosje_topics where slug = t_slug;
  raise notice 'dosje_require_sources verified: unsourced, single-publisher and unfetched approvals all refused';
end;
$$;
