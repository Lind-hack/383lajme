-- 0057 — One definition of "verified", used everywhere.
--
-- There were four, and they disagreed:
--
--   dosje_require_sources (0051)  http_status = 200
--   dosje_reverify        (0054)  http_status = 200 and fail_count < N
--   dosje_topic           (0054)  http_status = 200 and fail_count < 3
--   the admin queue               http_status === 200
--
-- The approval trigger was never taught about link rot, so a dead citation
-- still counted at the moment of approval. The consequence is a loop:
-- reverify demotes a moment whose source has died, the moment returns to the
-- queue, the queue counts the dead citation and enables the button, the
-- trigger counts it too and lets it through — and the moment goes back on the
-- site with nothing repaired. dosje_topic then filters that citation out, so
-- the page renders one source, or none, under a badge promising two.
--
-- A citation is verified when it last answered. That sentence is now written
-- once, as a function, and the trigger, the reverify pass and the read path
-- all call it.

create or replace function public.dosje_citation_is_live(
  p_http_status int,
  p_fail_count int
)
returns boolean
language sql
immutable
as $$
  select p_http_status = 200 and coalesce(p_fail_count, 0) < 3;
$$;

comment on function public.dosje_citation_is_live(int, int) is
  'The single definition of a verified citation: it answered 200 and has not failed its recent re-checks. Called by the approval trigger, the re-verification pass and the public read path.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The approval trigger, taught about rot
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

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- The same rule in the re-verification pass and the read path
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dosje_reverify(
  p_milestone uuid,
  p_dead_after int default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  select count(distinct lower(btrim(publisher)))
    into live_publishers
    from public.dosje_citations
   where milestone_id = p_milestone
     and publisher is not null
     and btrim(publisher) <> ''
     and public.dosje_citation_is_live(http_status, fail_count);

  if live_publishers >= 2 then
    update public.dosje_milestones
       set last_verified_at = now()
     where id = p_milestone;
    return jsonb_build_object('ok', true, 'publishers', live_publishers, 'status', was_status);
  end if;

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
  'Re-counts live publishers for one moment and demotes it below two. security definer with a fixed search_path, because it writes.';

-- 0054 revoked this from public without granting it to anyone, so either the
-- job could never call it or the intended boundary never existed. Stated
-- explicitly now: the service role only, and no one else.
revoke all on function public.dosje_reverify(uuid, int) from public, anon, authenticated;
grant execute on function public.dosje_reverify(uuid, int) to service_role;

revoke all on function public.dosje_next_subject(int, int) from public, anon, authenticated;
grant execute on function public.dosje_next_subject(int, int) to service_role;

revoke all on function public.dosje_citation_is_live(int, int) from public;
grant execute on function public.dosje_citation_is_live(int, int) to anon, authenticated, service_role;

-- The read path, using the shared rule rather than its own literal.
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
                       and public.dosje_citation_is_live(c.http_status, c.fail_count)
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

revoke all on function public.dosje_topic(text) from public;
grant execute on function public.dosje_topic(text) to anon, authenticated;

-- Prove the loop is closed, at apply time.
do $$
declare
  t_slug text := '__dosje_rot_loop__';
  m_id   uuid;
  raised boolean := false;
begin
  insert into public.dosje_topics (slug, title, blurb, status)
       values (t_slug, 'Loop', 'Loop', 'approved') on conflict (slug) do nothing;

  insert into public.dosje_milestones
         (topic_slug, event_date, display_date, title, summary, dedupe_key, status)
       values (t_slug, date '2020-01-01', '2020', 'Loop', 'Loop test summary', 'loop', 'draft')
    returning id into m_id;

  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
       values (m_id, 'https://example.org/a', 'A', 200),
              (m_id, 'https://example.org/b', 'B', 200);

  update public.dosje_milestones set status = 'approved' where id = m_id;

  -- One source rots past the threshold and reverify demotes the moment.
  update public.dosje_citations set fail_count = 3 where milestone_id = m_id and publisher = 'B';
  perform public.dosje_reverify(m_id);

  -- The bug: re-approving it used to succeed, because the trigger still
  -- counted the dead citation. It must now be refused.
  begin
    update public.dosje_milestones set status = 'approved' where id = m_id;
  exception when others then
    raised := true;
  end;
  if not raised then
    raise exception 'a moment with one dead source was re-approved';
  end if;

  -- And when the source recovers, approval works again.
  update public.dosje_citations set fail_count = 0 where milestone_id = m_id and publisher = 'B';
  update public.dosje_milestones set status = 'approved' where id = m_id;

  delete from public.dosje_topics where slug = t_slug;
  raise notice 'dosje: one verified rule — a rotted source blocks re-approval, a recovered one restores it';
end;
$$;
