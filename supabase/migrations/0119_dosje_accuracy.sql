-- 0119 — Dosje accuracy: two publishers per claim, and a record of every change.
--
-- 1. The approval trigger (0057) counted two live publishers across a whole
--    moment, so one sentence could rest on Reuters and the next on nobody but
--    BBC. Since 2026-11 every claim carries its own verbatim quotes with url
--    and publisher (lib/dosje-draft.mjs). The trigger now counts, per claim,
--    the distinct publishers whose quote comes from a live citation of this
--    moment, and refuses approval under two.
--
--    It applies when a moment becomes approved, or when an approved moment's
--    text, date or quotes change. Re-verification touching last_verified_at on an
--    already-approved moment is left alone; link rot is dosje_reverify's job.
--
-- 2. dosje_changes. Text was overwritten in place and only a boolean said it
--    had been; media and article links left no trace at all. Every change a
--    reader could see is now written here by triggers, whichever path made
--    it (the daily run, admin, re-verification), with before and after. The
--    daily email reads the rows not yet emailed, then stamps emailed_at.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Two live publishers per claim
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dosje_require_sources()
returns trigger
language plpgsql
as $$
declare
  verified_publishers int;
  claim jsonb;
  claim_publishers int;
  claim_no int := 0;
  becoming boolean;
begin
  if new.status is distinct from 'approved' then
    return new;
  end if;

  becoming := tg_op = 'INSERT'
    or old.status is distinct from 'approved'
    or old.title is distinct from new.title
    or old.summary is distinct from new.summary
    or old.why is distinct from new.why
    or old.event_date is distinct from new.event_date
    or old.date_precision is distinct from new.date_precision
    or old.claims is distinct from new.claims;

  select count(distinct lower(btrim(publisher)))
    into verified_publishers
    from public.dosje_citations
   where milestone_id = new.id
     and publisher is not null
     and btrim(publisher) <> ''
     and public.dosje_citation_is_live(http_status, fail_count);

  if verified_publishers < 2 then
    raise exception
      'Një moment nuk mund të miratohet pa dy burime të gjalla nga botues të ndryshëm (gjetur: %)',
      verified_publishers;
  end if;

  if coalesce((new.claims ->> 'edited_after_verification')::boolean, false) then
    raise exception
      'Teksti është ndryshuar pas verifikimit — burimet duhet të rikontrollohen para miratimit';
  end if;

  if not becoming then
    return new;
  end if;

  if jsonb_typeof(new.claims -> 'sentences') is distinct from 'array'
     or jsonb_array_length(new.claims -> 'sentences') = 0 then
    raise exception 'Momenti nuk ka fjali me citate — nuk mund të miratohet';
  end if;

  for claim in select * from jsonb_array_elements(new.claims -> 'sentences') loop
    claim_no := claim_no + 1;
    select count(distinct lower(btrim(q ->> 'publisher')))
      into claim_publishers
      from jsonb_array_elements(
             case when jsonb_typeof(claim -> 'quotes') = 'array' then claim -> 'quotes' else '[]'::jsonb end) q
     where coalesce(btrim(q ->> 'publisher'), '') <> ''
       and length(coalesce(q ->> 'text', '')) >= 20
       and exists (
         select 1
           from public.dosje_citations c
          where c.milestone_id = new.id
            and c.url = q ->> 'url'
            and public.dosje_citation_is_live(c.http_status, c.fail_count)
       );
    if claim_publishers < 2 then
      raise exception
        'Fjalia % e momentit ka citate nga % botues të gjallë; duhen dy',
        claim_no, claim_publishers;
    end if;
  end loop;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The change log
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.dosje_changes (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  topic_slug    text not null,
  milestone_id  uuid,
  kind          text not null check (kind in (
                  'topic_new', 'topic_status', 'topic_text',
                  'moment_new', 'moment_text', 'moment_hidden',
                  'image', 'video',
                  'article_link', 'article_unlink')),
  before        jsonb,
  after         jsonb,
  actor         text,
  emailed_at    timestamptz
);

create index if not exists dosje_changes_unemailed on public.dosje_changes (at) where emailed_at is null;

alter table public.dosje_changes enable row level security;
-- No policies: the service role (the site's automation routes) reads and stamps it.

comment on table public.dosje_changes is
  'Every reader-visible dosje change, written by triggers with before/after. The daily email reads rows where emailed_at is null.';

create or replace function public.dosje_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Who made the change: the site sends x-dosje-actor ("admin", "dosje-daily")
  -- and PostgREST exposes request headers as a setting.
  actor_name text := coalesce(
    nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-dosje-actor', ''),
    nullif(current_setting('dosje.actor', true), ''),
    current_user);
begin
  if tg_table_name = 'dosje_topics' then
    if tg_op = 'INSERT' then
      insert into dosje_changes (topic_slug, kind, after, actor)
      values (new.slug, 'topic_new', jsonb_build_object('title', new.title, 'status', new.status, 'primer', new.primer), actor_name);
    elsif old.status is distinct from new.status then
      insert into dosje_changes (topic_slug, kind, before, after, actor)
      values (new.slug, 'topic_status', jsonb_build_object('status', old.status, 'title', old.title),
              jsonb_build_object('status', new.status, 'title', new.title), actor_name);
    elsif new.status = 'approved'
          and (old.title is distinct from new.title or old.blurb is distinct from new.blurb or old.primer is distinct from new.primer) then
      insert into dosje_changes (topic_slug, kind, before, after, actor)
      values (new.slug, 'topic_text',
              jsonb_build_object('title', old.title, 'blurb', old.blurb, 'primer', old.primer),
              jsonb_build_object('title', new.title, 'blurb', new.blurb, 'primer', new.primer), actor_name);
    end if;
    return null;
  end if;

  if tg_table_name = 'dosje_milestones' then
    if tg_op = 'UPDATE' and old.status is distinct from 'approved' and new.status = 'approved' then
      insert into dosje_changes (topic_slug, milestone_id, kind, after, actor)
      values (new.topic_slug, new.id, 'moment_new',
              jsonb_build_object('title', new.title, 'display_date', new.display_date, 'summary', new.summary, 'why', new.why),
              coalesce(new.approved_by, actor_name));
    elsif tg_op = 'UPDATE' and old.status = 'approved' and new.status is distinct from 'approved' then
      insert into dosje_changes (topic_slug, milestone_id, kind, before, after, actor)
      values (new.topic_slug, new.id, 'moment_hidden',
              jsonb_build_object('title', old.title, 'display_date', old.display_date, 'status', old.status),
              jsonb_build_object('status', new.status), actor_name);
    -- Only text a reader sees: edits to a draft or a moment in review are not news.
    elsif tg_op = 'UPDATE' and new.status = 'approved'
          and (old.title is distinct from new.title or old.summary is distinct from new.summary
          or old.why is distinct from new.why or old.display_date is distinct from new.display_date) then
      insert into dosje_changes (topic_slug, milestone_id, kind, before, after, actor)
      values (new.topic_slug, new.id, 'moment_text',
              jsonb_build_object('title', old.title, 'display_date', old.display_date, 'summary', old.summary, 'why', old.why, 'status', old.status),
              jsonb_build_object('title', new.title, 'display_date', new.display_date, 'summary', new.summary, 'why', new.why, 'status', new.status),
              actor_name);
    elsif tg_op = 'DELETE' and old.status = 'approved' then
      insert into dosje_changes (topic_slug, milestone_id, kind, before, actor)
      values (old.topic_slug, old.id, 'moment_hidden',
              jsonb_build_object('title', old.title, 'display_date', old.display_date, 'deleted', true), actor_name);
    end if;
    return null;
  end if;

  if tg_table_name = 'dosje_media' then
    if tg_op = 'INSERT' then
      insert into dosje_changes (topic_slug, milestone_id, kind, after, actor)
      values (coalesce(new.topic_slug, (select topic_slug from dosje_milestones where id = new.milestone_id), '?'),
              new.milestone_id, new.kind,
              jsonb_build_object('url', new.url, 'credit', new.credit, 'approved', new.approved), actor_name);
    elsif tg_op = 'DELETE' then
      insert into dosje_changes (topic_slug, milestone_id, kind, before, actor)
      values (coalesce(old.topic_slug, (select topic_slug from dosje_milestones where id = old.milestone_id), '?'),
              old.milestone_id, old.kind,
              jsonb_build_object('url', old.url, 'credit', old.credit, 'approved', old.approved), actor_name);
    elsif old.approved is distinct from new.approved or old.url is distinct from new.url then
      insert into dosje_changes (topic_slug, milestone_id, kind, before, after, actor)
      values (coalesce(new.topic_slug, (select topic_slug from dosje_milestones where id = new.milestone_id), '?'),
              new.milestone_id, new.kind,
              jsonb_build_object('url', old.url, 'approved', old.approved),
              jsonb_build_object('url', new.url, 'credit', new.credit, 'approved', new.approved),
              coalesce(new.approved_by, actor_name));
    end if;
    return null;
  end if;

  if tg_table_name = 'dosje_article_topics' then
    if tg_op = 'INSERT' then
      insert into dosje_changes (topic_slug, kind, after, actor)
      values (new.topic_slug, 'article_link', jsonb_build_object('article_slug', new.article_slug), actor_name);
    elsif tg_op = 'DELETE' then
      insert into dosje_changes (topic_slug, kind, before, actor)
      values (old.topic_slug, 'article_unlink', jsonb_build_object('article_slug', old.article_slug), actor_name);
    end if;
    return null;
  end if;

  return null;
end;
$$;

revoke all on function public.dosje_log_change() from public, anon, authenticated;

drop trigger if exists dosje_topics_log on public.dosje_topics;
create trigger dosje_topics_log after insert or update on public.dosje_topics
  for each row execute function public.dosje_log_change();

drop trigger if exists dosje_milestones_log on public.dosje_milestones;
create trigger dosje_milestones_log after update or delete on public.dosje_milestones
  for each row execute function public.dosje_log_change();

drop trigger if exists dosje_media_log on public.dosje_media;
create trigger dosje_media_log after insert or update or delete on public.dosje_media
  for each row execute function public.dosje_log_change();

drop trigger if exists dosje_article_topics_log on public.dosje_article_topics;
create trigger dosje_article_topics_log after insert or delete on public.dosje_article_topics
  for each row execute function public.dosje_log_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- Self-check, inside this migration's transaction: a throwaway topic and
-- moment prove both rules, then everything is removed.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  m uuid;
  refused boolean := false;
  logged int;
begin
  insert into public.dosje_topics (slug, title, blurb) values ('__0119_check', 'check', 'check');
  insert into public.dosje_milestones (topic_slug, event_date, display_date, title, summary, status, claims, dedupe_key)
  values ('__0119_check', '2004-03-17', '17 mars 2004', 'check moment', 'check summary text long enough', 'draft',
          jsonb_build_object('sentences', jsonb_build_array(jsonb_build_object(
            'sentence', 'x',
            'quotes', jsonb_build_array(
              jsonb_build_object('url', 'https://a.example/1', 'publisher', 'A', 'text', 'a quote that is long enough'))))),
          '__0119_check')
  returning id into m;
  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
  values (m, 'https://a.example/1', 'A', 200), (m, 'https://b.example/1', 'B', 200);

  -- Two live publishers on the moment, but the one claim is quoted by A only.
  begin
    update public.dosje_milestones set status = 'approved' where id = m;
  exception when raise_exception then
    refused := true;
  end;
  if not refused then
    raise exception '0119 self-check: a claim with one quoted publisher was approved';
  end if;

  update public.dosje_milestones
     set claims = jsonb_build_object('sentences', jsonb_build_array(jsonb_build_object(
           'sentence', 'x',
           'quotes', jsonb_build_array(
             jsonb_build_object('url', 'https://a.example/1', 'publisher', 'A', 'text', 'a quote that is long enough'),
             jsonb_build_object('url', 'https://b.example/1', 'publisher', 'B', 'text', 'another quote long enough')))))
   where id = m;
  update public.dosje_milestones set status = 'approved' where id = m;

  select count(*) into logged from public.dosje_changes
   where topic_slug = '__0119_check' and kind in ('topic_new', 'moment_new');
  if logged <> 2 then
    raise exception '0119 self-check: expected topic_new and moment_new in dosje_changes, found %', logged;
  end if;

  delete from public.dosje_topics where slug = '__0119_check';
  delete from public.dosje_changes where topic_slug = '__0119_check';
end;
$$;

notify pgrst, 'reload schema';
