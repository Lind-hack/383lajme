-- 0055 — Close the loop: the research job picks its own subject.
--
-- dosje-subjects has been running every two hours, mapping new articles to
-- dossiers and working out which subjects are standing. dosje-research then
-- ignored all of it and ran on a hardcoded "KFOR Kosovo" every night. The two
-- halves were never connected, so the loop looked closed and was not: the same
-- subject was researched forever, it happened to return one publisher, and the
-- job failed and slept for thirty days on repeat.
--
-- Two things were missing. Somewhere to record which subject a dossier should
-- be researched under, and a way to choose the next one.
--
-- The search term is its own field because the dossier's title is Albanian and
-- written for a reader, while the evidence search reads English reference
-- lists. "Rruga e Kosovës drejt BE-së" is the right heading and the wrong
-- query, and conflating the two is why the search kept landing on the wrong
-- page.

alter table public.dosje_topics
  add column if not exists research_query text;

comment on column public.dosje_topics.research_query is
  'English phrase used to find source material for this dossier. Distinct from the title, which is Albanian and written for a reader rather than a search.';

update public.dosje_topics set research_query = 'Kosovo Serbia normalization dialogue'
 where slug = 'dialogu-kosove-serbi' and research_query is null;
update public.dosje_topics set research_query = 'Kosovo Force NATO peacekeeping Kosovo'
 where slug = 'kfor' and research_query is null;
update public.dosje_topics set research_query = 'Kosovo European Union accession'
 where slug = 'anetaresimi-ne-be' and research_query is null;
update public.dosje_topics set research_query = 'Kosovo diaspora remittances'
 where slug = 'diaspora' and research_query is null;
update public.dosje_topics set research_query = 'United States Kosovo Balkans policy'
 where slug = 'trump-dhe-ballkani' and research_query is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Which subject to research next
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The candidate is a topic that recent news keeps returning to, that is not on
-- a cooldown from a previous run, and that was researched longest ago. That
-- ordering matters: without it a single busy subject would monopolise the job
-- and the quiet dossiers would never be built at all.
create or replace function public.dosje_next_subject(
  p_min_articles int default 3,
  p_min_days int default 2
)
returns jsonb
language sql
stable
as $$
  with recent as (
    select
      t.slug,
      t.title,
      coalesce(t.research_query, t.title) as query,
      count(*) as articles,
      count(distinct at.decided_at::date) as days
      from public.dosje_topics t
      join public.dosje_article_topics at on at.topic_slug = t.slug
     where t.status <> 'retired'
       and at.decided_at > now() - interval '30 days'
     group by t.slug, t.title, t.research_query
  ),
  eligible as (
    select r.*,
           (
             select max(run_date) from public.dosje_research_runs x
              where x.subject_key = r.query
           ) as last_run
      from recent r
     where r.articles >= p_min_articles
       and r.days >= p_min_days
       -- A subject that yielded nothing recently is left alone until its
       -- cooldown expires, so the job does not spend every night failing on
       -- the same one.
       and not exists (
         select 1 from public.dosje_research_runs c
          where c.subject_key = r.query
            and c.cooldown_until is not null
            and c.cooldown_until > current_date
       )
  )
  select coalesce(
    (
      select jsonb_build_object(
               'topic', slug, 'title', title, 'subject', query,
               'articles', articles, 'days', days, 'lastRun', last_run)
        from eligible
       -- Never researched first, then whichever waited longest.
       order by last_run nulls first, articles desc
       limit 1
    ),
    jsonb_build_object('topic', null)
  );
$$;

comment on function public.dosje_next_subject(int, int) is
  'The dossier most worth researching now: recurring in recent news, not on cooldown, waiting longest. Null when nothing qualifies, which is a normal answer.';

revoke all on function public.dosje_next_subject(int, int) from public;

-- Prove the selection, at apply time.
do $$
declare
  picked jsonb;
begin
  insert into public.dosje_topics (slug, title, blurb, status, research_query)
       values ('__next_test__', 'Next', 'Next', 'draft', 'next test subject')
    on conflict (slug) do nothing;

  -- One article is not a standing subject.
  insert into public.dosje_article_topics (article_slug, topic_slug, score, decided_at)
       values ('a1', '__next_test__', 5, now())
    on conflict (article_slug, topic_slug) do nothing;

  picked := public.dosje_next_subject();
  if picked ->> 'topic' = '__next_test__' then
    raise exception 'a subject with one article was treated as standing';
  end if;

  -- Three articles across three days is.
  insert into public.dosje_article_topics (article_slug, topic_slug, score, decided_at)
       values ('a2', '__next_test__', 5, now() - interval '1 day'),
              ('a3', '__next_test__', 5, now() - interval '2 days')
    on conflict (article_slug, topic_slug) do nothing;

  picked := public.dosje_next_subject();
  if picked ->> 'topic' is null then
    raise exception 'a standing subject was not picked up';
  end if;

  -- On cooldown, it is skipped.
  insert into public.dosje_research_runs (subject_key, run_date, outcome, cooldown_until)
       values ('next test subject', current_date, 'no_sources', current_date + 7)
    on conflict (subject_key, run_date) do nothing;

  picked := public.dosje_next_subject();
  if picked ->> 'topic' = '__next_test__' then
    raise exception 'a subject on cooldown was picked anyway';
  end if;

  delete from public.dosje_article_topics where topic_slug = '__next_test__';
  delete from public.dosje_research_runs where subject_key = 'next test subject';
  delete from public.dosje_topics where slug = '__next_test__';
  raise notice 'dosje_next_subject verified: one article is not a subject, three across days is, cooldown is respected';
end;
$$;
