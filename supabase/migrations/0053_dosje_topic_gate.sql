-- 0053 — A moment is public only if its dossier is.
--
-- 0051 gated the topic on approval but not the moments underneath it. The
-- milestone policy asked only whether the milestone was approved, and
-- dosje_topic() did the same, so a dossier still in review returned its
-- moments and their citations to anyone with the anon key while reporting
-- topic: null. Caught by reading the RPC's own output during QA.
--
-- Approving a moment says its text is sourced. Approving a topic says the
-- subject should be a file on the site at all. Both are required before a
-- reader sees anything, and that is now true in one place — the database —
-- rather than depending on every caller remembering to check.

drop policy if exists dosje_milestones_public_read on public.dosje_milestones;
create policy dosje_milestones_public_read
  on public.dosje_milestones for select
  using (
    status = 'approved'
    and exists (
      select 1 from public.dosje_topics t
       where t.slug = dosje_milestones.topic_slug
         and t.status = 'approved'
    )
  );

-- Citations follow their milestone, which now follows its topic.
drop policy if exists dosje_citations_public_read on public.dosje_citations;
create policy dosje_citations_public_read
  on public.dosje_citations for select
  using (
    exists (
      select 1
        from public.dosje_milestones m
        join public.dosje_topics t on t.slug = m.topic_slug
       where m.id = dosje_citations.milestone_id
         and m.status = 'approved'
         and t.status = 'approved'
    )
  );

-- Media likewise: an approved photograph attached to a moment nobody can see
-- must not be reachable either.
drop policy if exists dosje_media_public_read on public.dosje_media;
create policy dosje_media_public_read
  on public.dosje_media for select
  using (
    approved = true
    and (
      (milestone_id is not null and exists (
        select 1
          from public.dosje_milestones m
          join public.dosje_topics t on t.slug = m.topic_slug
         where m.id = dosje_media.milestone_id
           and m.status = 'approved'
           and t.status = 'approved'
      ))
      or
      (topic_slug is not null and exists (
        select 1 from public.dosje_topics t
         where t.slug = dosje_media.topic_slug
           and t.status = 'approved'
      ))
    )
  );

-- The read function stops relying on the caller and states the rule itself.
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
      -- No approved dossier: nothing at all, not an empty shell that a caller
      -- might mistake for one with no moments yet.
      jsonb_build_object('topic', null, 'milestones', '[]'::jsonb, 'videos', '[]'::jsonb)
    else jsonb_build_object(
      'topic', (select to_jsonb(l) from live l),
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
  'One approved dossier. Returns nothing at all unless the topic itself is approved — a moment is public only if its file is.';

revoke all on function public.dosje_topic(text) from public;
grant execute on function public.dosje_topic(text) to anon, authenticated;

-- Prove the gate, at apply time.
do $$
declare
  t_slug text := '__dosje_gate_test__';
  m_id   uuid;
  seen   int;
begin
  insert into public.dosje_topics (slug, title, blurb, status)
       values (t_slug, 'Gate', 'Gate', 'draft') on conflict (slug) do nothing;

  insert into public.dosje_milestones
         (topic_slug, event_date, display_date, title, summary, dedupe_key, status)
       values (t_slug, date '2020-01-01', '2020', 'Gate', 'Gate test summary', 'gate', 'draft')
    returning id into m_id;

  insert into public.dosje_citations (milestone_id, url, publisher, http_status)
       values (m_id, 'https://example.org/one', 'A', 200),
              (m_id, 'https://example.org/two', 'B', 200);

  update public.dosje_milestones set status = 'approved' where id = m_id;

  -- The moment is approved; the dossier is not. Nothing may come back.
  select coalesce(jsonb_array_length(public.dosje_topic(t_slug) -> 'milestones'), 0)
    into seen;
  if seen <> 0 then
    raise exception 'dosje_topic returned % moments for an unapproved dossier', seen;
  end if;

  update public.dosje_topics set status = 'approved' where slug = t_slug;
  select coalesce(jsonb_array_length(public.dosje_topic(t_slug) -> 'milestones'), 0)
    into seen;
  if seen <> 1 then
    raise exception 'dosje_topic returned % moments for an approved dossier, expected 1', seen;
  end if;

  delete from public.dosje_topics where slug = t_slug;
  raise notice 'dosje_topic gate verified: hidden while the dossier is in review, visible once approved';
end;
$$;
