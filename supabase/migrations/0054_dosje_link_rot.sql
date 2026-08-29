-- 0054 — Citations decay, and the page has to notice.
--
-- A citation is fetched once, stored with http_status 200, and then never
-- looked at again. Newsrooms restructure, archives move, publishers fold. In a
-- year some of those links will 404 while the dossier keeps asserting the claim
-- and the badge keeps promising "two verified sources" — a promise that quietly
-- stopped being true.
--
-- That failure is worse than an ordinary broken link. The whole feature rests
-- on the reader being able to check a claim, so a citation that no longer
-- resolves does not merely look untidy; it removes the thing that made the
-- claim publishable.
--
-- Two columns and one rule:
--   a citation counts as verified only if its last check succeeded
--   a milestone that falls below two verified publishers stops being published

alter table public.dosje_citations
  add column if not exists fail_count int not null default 0,
  add column if not exists last_ok_at timestamptz;

comment on column public.dosje_citations.fail_count is
  'Consecutive failed re-checks. One failure is not evidence — a newsroom has a bad afternoon — so a citation is only treated as gone after several in a row.';
comment on column public.dosje_citations.last_ok_at is
  'When this url last answered 200. What the reader is shown as the verification date.';

-- Everything already stored was verified at the moment it was written.
update public.dosje_citations
   set last_ok_at = coalesce(last_ok_at, fetched_at)
 where http_status = 200 and last_ok_at is null;

alter table public.dosje_milestones
  add column if not exists last_verified_at timestamptz;

comment on column public.dosje_milestones.last_verified_at is
  'When this moment was last confirmed to still rest on two live sources. Shown to the reader, because recency of checking is the trust signal.';

update public.dosje_milestones m
   set last_verified_at = (
     select max(c.fetched_at) from public.dosje_citations c
      where c.milestone_id = m.id and c.http_status = 200
   )
 where last_verified_at is null;

create index if not exists dosje_citations_recheck
  on public.dosje_citations (last_ok_at nulls first);

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-verification, as one transaction the job can call per milestone
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dosje_reverify(
  p_milestone uuid,
  p_dead_after int default 3
)
returns jsonb
language plpgsql
as $$
declare
  live_publishers int;
  was_status text;
begin
  select status into was_status
    from public.dosje_milestones where id = p_milestone;
  if was_status is null then
    return jsonb_build_object('ok', false, 'reason', 'no_such_milestone');
  end if;

  -- A citation is live while its recent checks have succeeded. p_dead_after
  -- consecutive failures is the point at which a transient outage stops being
  -- a plausible explanation.
  select count(distinct lower(btrim(publisher)))
    into live_publishers
    from public.dosje_citations
   where milestone_id = p_milestone
     and publisher is not null
     and btrim(publisher) <> ''
     and http_status = 200
     and fail_count < p_dead_after;

  if live_publishers >= 2 then
    update public.dosje_milestones
       set last_verified_at = now()
     where id = p_milestone;
    return jsonb_build_object('ok', true, 'publishers', live_publishers, 'status', was_status);
  end if;

  -- The guarantee has lapsed. The moment comes off the site and goes back to
  -- the queue rather than staying up with a promise it can no longer keep.
  -- It is not rejected: nothing about it was judged wrong, its evidence simply
  -- stopped answering, and an editor may repair it.
  if was_status = 'approved' then
    update public.dosje_milestones
       set status = 'needs_source',
           last_verified_at = now()
     where id = p_milestone;
  end if;

  return jsonb_build_object(
    'ok', false,
    'reason', 'insufficient_live_publishers',
    'publishers', live_publishers,
    'was', was_status,
    'now', case when was_status = 'approved' then 'needs_source' else was_status end
  );
end;
$$;

comment on function public.dosje_reverify(uuid, int) is
  'Re-counts live publishers for one moment. Below two, an approved moment is demoted to needs_source: the page must not keep promising verification that has lapsed.';

revoke all on function public.dosje_reverify(uuid, int) from public;

-- The reader sees when it was last checked.
drop function if exists public.dosje_topic(text);
create or replace function public.dosje_topic(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select slug, title, blurb
      from public.dosje_topics
     where slug = p_slug and status = 'approved'
  )
  select case
    when not exists (select 1 from live) then
      jsonb_build_object('topic', null, 'milestones', '[]'::jsonb, 'videos', '[]'::jsonb)
    else jsonb_build_object(
      'topic', (select to_jsonb(l) from live l),
      'milestones', coalesce(
        (
          select jsonb_agg(ms order by ms.event_date)
            from (
              select
                m.id, m.event_date, m.date_precision, m.display_date,
                m.tag, m.title, m.summary, m.why, m.last_verified_at,
                coalesce(
                  (
                    select jsonb_agg(jsonb_build_object(
                             'url', c.url, 'publisher', c.publisher,
                             'title', c.source_title, 'date', c.source_date,
                             'quote', c.quote, 'lastOkAt', c.last_ok_at))
                      from public.dosje_citations c
                     where c.milestone_id = m.id
                       and c.http_status = 200
                       and c.fail_count < 3
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
               where m.topic_slug = p_slug
                 and m.status = 'approved'
                 and exists (select 1 from live)
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
    )
  end;
$$;

comment on function public.dosje_topic(text) is
  'One approved dossier, with each moment''s verified citations, their quotes, and when they last answered.';

revoke all on function public.dosje_topic(text) from public;
grant execute on function public.dosje_topic(text) to anon, authenticated;

-- Prove the demotion, at apply time.
do $$
declare
  t_slug text := '__dosje_rot_test__';
  m_id   uuid;
  res    jsonb;
  st     text;
begin
  insert into public.dosje_topics (slug, title, blurb, status)
       values (t_slug, 'Rot', 'Rot', 'approved') on conflict (slug) do nothing;

  insert into public.dosje_milestones
         (topic_slug, event_date, display_date, title, summary, dedupe_key, status)
       values (t_slug, date '2020-01-01', '2020', 'Rot', 'Rot test summary', 'rot', 'draft')
    returning id into m_id;

  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
       values (m_id, 'https://example.org/a', 'A', 200),
              (m_id, 'https://example.org/b', 'B', 200);

  update public.dosje_milestones set status = 'approved' where id = m_id;

  -- Both live: stays approved.
  res := public.dosje_reverify(m_id);
  if (res ->> 'ok')::boolean is not true then
    raise exception 'dosje_reverify demoted a moment with two live sources: %', res;
  end if;

  -- One rots past the threshold: the promise lapses, the moment comes down.
  update public.dosje_citations set fail_count = 3 where milestone_id = m_id and publisher = 'B';
  res := public.dosje_reverify(m_id);
  select status into st from public.dosje_milestones where id = m_id;
  if st <> 'needs_source' then
    raise exception 'a moment with one live source stayed %, expected needs_source', st;
  end if;

  -- And it is no longer readable.
  if coalesce(jsonb_array_length(public.dosje_topic(t_slug) -> 'milestones'), 0) <> 0 then
    raise exception 'a demoted moment is still being served';
  end if;

  delete from public.dosje_topics where slug = t_slug;
  raise notice 'dosje_reverify verified: two live sources hold, one live source demotes and stops being served';
end;
$$;
