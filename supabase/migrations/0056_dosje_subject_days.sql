-- 0056 — Count the days the news happened, not the day we looked.
--
-- dosje_next_subject asked whether a subject had appeared across two separate
-- days, and measured that with decided_at — the moment the mapping job ran. A
-- single run stamps every row with the same timestamp, and because the job
-- upserts, a later run bumps the old rows to today as well. So the count was
-- always one, the threshold was two, and the selector could never return
-- anything.
--
-- The nightly research job therefore answered "no_candidate" every night, on
-- schedule, looking exactly like a quiet news week. This is the second bug in
-- this chain of the same shape: working in every log line, doing nothing.
--
-- The question was always about the news, not about us. isStandingSubject in
-- lib/dosje-match.mjs had it right and counted article publication dates; the
-- SQL disagreed with it, and the SQL was wrong.

alter table public.dosje_article_topics
  add column if not exists published_at timestamptz;

comment on column public.dosje_article_topics.published_at is
  'When the article was published. A subject is standing because the news kept returning to it, which is a fact about the articles and not about when the mapping job happened to run.';

create index if not exists dosje_article_topics_published
  on public.dosje_article_topics (topic_slug, published_at desc);

-- Backfill from the article rows we already hold, so existing mappings are
-- usable immediately rather than waiting for every article to be re-seen.
update public.dosje_article_topics at
   set published_at = na.published_at
  from public.news_articles na
 where na.slug = at.article_slug
   and at.published_at is null;

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
      -- The days the news happened. Falls back to the decision date only for
      -- rows old enough to predate this column, so the backfill gap does not
      -- silently reintroduce the bug.
      count(distinct coalesce(at.published_at, at.decided_at)::date) as days
      from public.dosje_topics t
      join public.dosje_article_topics at on at.topic_slug = t.slug
     where t.status <> 'retired'
       and coalesce(at.published_at, at.decided_at) > now() - interval '30 days'
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
       order by last_run nulls first, articles desc
       limit 1
    ),
    jsonb_build_object('topic', null)
  );
$$;

comment on function public.dosje_next_subject(int, int) is
  'The dossier most worth researching now: the news returned to it across separate days, it is off cooldown, and it has waited longest.';

revoke all on function public.dosje_next_subject(int, int) from public;

-- Prove it, at apply time — specifically the case that was broken: everything
-- mapped in one run, about articles published on different days.
do $$
declare
  picked jsonb;
  today  timestamptz := now();
begin
  insert into public.dosje_topics (slug, title, blurb, status, research_query)
       values ('__days_test__', 'Days', 'Days', 'draft', 'days test subject')
    on conflict (slug) do nothing;

  -- One mapping run, one decided_at, three articles from three different days.
  insert into public.dosje_article_topics
         (article_slug, topic_slug, score, decided_at, published_at)
       values ('d1', '__days_test__', 5, today, today - interval '1 day'),
              ('d2', '__days_test__', 5, today, today - interval '2 days'),
              ('d3', '__days_test__', 5, today, today - interval '3 days')
    on conflict (article_slug, topic_slug) do nothing;

  picked := public.dosje_next_subject();
  if picked ->> 'topic' is distinct from '__days_test__' then
    raise exception
      'a subject seen across three publication days was not selected (got %)', picked;
  end if;

  -- And the case that must still be refused: three articles, all same day.
  delete from public.dosje_article_topics where topic_slug = '__days_test__';
  insert into public.dosje_article_topics
         (article_slug, topic_slug, score, decided_at, published_at)
       values ('s1', '__days_test__', 5, today, today),
              ('s2', '__days_test__', 5, today, today),
              ('s3', '__days_test__', 5, today, today)
    on conflict (article_slug, topic_slug) do nothing;

  picked := public.dosje_next_subject();
  if picked ->> 'topic' = '__days_test__' then
    raise exception 'three articles from one day were treated as a standing subject';
  end if;

  delete from public.dosje_article_topics where topic_slug = '__days_test__';
  delete from public.dosje_topics where slug = '__days_test__';
  raise notice 'dosje_next_subject verified: one mapping run across three publication days selects; one busy day does not';
end;
$$;
