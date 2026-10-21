-- ─────────────────────────────────────────────────────────────────────────────
-- 0115 — the daily dossier run
--
-- Dossiers are now written by one daily job (scripts/run-dosje-daily.mjs on the
-- VPS) and published automatically when they pass verification, instead of
-- waiting in /admin/dosje for approval that rarely came: in October 2026 the
-- table held 44 drafts and 2 approved moments.
--
-- Three things here:
--
-- 1. Topics carry their own matching vocabulary. The event fingerprints
--    (match_groups) and context terms lived only in lib/topics.mjs, so a topic
--    that existed only in the database matched on one anchor alone — a lone
--    "Kurti" was enough. Topics are now created by the daily run, so they need
--    the columns the hand-written file used to supply. `primer` is the two or
--    three sentence "Në pak fjalë" that opens a dossier.
--
-- 2. dosje_publish_bundle(): one call publishes a topic and its moments. The
--    approval trigger (dosje_require_sources, BEFORE INSERT OR UPDATE) counts a
--    moment's live citations, so a moment inserted as 'approved' has none yet
--    and is always refused. The function therefore inserts each moment as a
--    draft, inserts its citations, then approves it — the trigger judges the
--    complete row. Each moment is its own subtransaction: a refusal rolls back
--    only that moment. Only the trigger's refusal (P0001) and a duplicate
--    (23505) are reported as outcomes; any other error aborts the whole call,
--    so a bug is never reported as a refusal.
--
--    A topic is inserted as a draft. On conflict its title, blurb and primer
--    are refreshed (vocabulary is set when the topic is created) but its status
--    is never touched, so re-running can never hide a
--    live dossier. It becomes approved only when at least one of its moments
--    did.
--
-- 3. The research-run ledger learns the 'published' outcome.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.dosje_topics
  add column if not exists match_groups    jsonb  not null default '[]'::jsonb,
  add column if not exists context         text[] not null default '{}',
  add column if not exists research_groups jsonb,
  add column if not exists primer          text,
  add column if not exists created_by      text;

comment on column public.dosje_topics.match_groups is
  'Event fingerprints: each inner array is a set of terms that must all appear. Read by lib/dosje-match.mjs scoreTopic.';
comment on column public.dosje_topics.primer is
  'Two or three sentences, each backed by a cited source, that open the dossier ("Në pak fjalë").';

alter table public.dosje_milestones
  add column if not exists model text;

comment on column public.dosje_milestones.model is
  'The model that drafted this moment (gpt-6-luna, or the Gemini fallback). Reported in the daily email.';

alter table public.dosje_research_runs
  drop constraint if exists dosje_research_runs_outcome_check;
alter table public.dosje_research_runs
  add constraint dosje_research_runs_outcome_check
  check (outcome in ('in_progress', 'drafted', 'published', 'no_subject',
                     'no_sources', 'duplicate', 'llm_failed', 'verify_failed', 'abandoned'));

create or replace function public.dosje_publish_bundle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t           jsonb := p -> 'topic';
  m           jsonb;
  c           jsonb;
  m_id        uuid;
  results     jsonb := '[]'::jsonb;
  approved_n  int := 0;
  topic_was   text;
begin
  if t is null or coalesce(t ->> 'slug', '') = '' then
    raise exception using errcode = '22023', message = 'dosje_publish_bundle: topic.slug is required';
  end if;

  insert into public.dosje_topics as dt
    (slug, title, blurb, status, anchors, signals, excludes, match_groups, context, research_groups, primer, created_by)
  values (
    t ->> 'slug',
    t ->> 'title',
    coalesce(t ->> 'blurb', ''),
    'draft',
    coalesce(array(select jsonb_array_elements_text(t -> 'anchors')), '{}'),
    coalesce(array(select jsonb_array_elements_text(t -> 'signals')), '{}'),
    coalesce(array(select jsonb_array_elements_text(t -> 'excludes')), '{}'),
    coalesce(t -> 'match_groups', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(t -> 'context')), '{}'),
    t -> 'research_groups',
    nullif(t ->> 'primer', ''),
    t ->> 'created_by'
  )
  on conflict (slug) do update set
    -- Wording and vocabulary only; status is deliberately absent.
    title      = coalesce(nullif(excluded.title, ''), dt.title),
    blurb      = coalesce(nullif(excluded.blurb, ''), dt.blurb),
    primer     = coalesce(excluded.primer, dt.primer),
    updated_at = now();

  select status into topic_was from public.dosje_topics where slug = t ->> 'slug';

  for m in select * from jsonb_array_elements(coalesce(p -> 'milestones', '[]'::jsonb)) loop
    begin
      insert into public.dosje_milestones
        (topic_slug, event_date, date_precision, display_date, tag, title, summary, why,
         status, claims, drafted_by, model, dedupe_key)
      values (
        t ->> 'slug',
        (m ->> 'event_date')::date,
        coalesce(m ->> 'date_precision', 'day'),
        m ->> 'display_date',
        nullif(m ->> 'tag', ''),
        m ->> 'title',
        m ->> 'summary',
        nullif(m ->> 'why', ''),
        'draft',
        coalesce(m -> 'claims', '{}'::jsonb),
        coalesce(m ->> 'drafted_by', 'dosje-daily'),
        m ->> 'model',
        m ->> 'dedupe_key'
      )
      returning id into m_id;

      for c in select * from jsonb_array_elements(coalesce(m -> 'citations', '[]'::jsonb)) loop
        insert into public.dosje_citations
          (milestone_id, url, publisher, source_title, source_date, quote, fetched_at, http_status, archive_url)
        values (
          m_id,
          c ->> 'url',
          c ->> 'publisher',
          nullif(c ->> 'source_title', ''),
          nullif(c ->> 'source_date', '')::date,
          nullif(c ->> 'quote', ''),
          coalesce((c ->> 'fetched_at')::timestamptz, now()),
          (c ->> 'http_status')::int,
          nullif(c ->> 'archive_url', '')
        )
        on conflict (milestone_id, url) do nothing;
      end loop;

      update public.dosje_milestones
         set status = 'approved', approved_at = now(), approved_by = 'dosje-daily', last_verified_at = now()
       where id = m_id;

      approved_n := approved_n + 1;
      results := results || jsonb_build_object('dedupe_key', m ->> 'dedupe_key', 'title', m ->> 'title', 'outcome', 'approved', 'id', m_id);
    exception
      when raise_exception then
        results := results || jsonb_build_object('dedupe_key', m ->> 'dedupe_key', 'title', m ->> 'title', 'outcome', 'refused', 'reason', sqlerrm);
      when unique_violation then
        results := results || jsonb_build_object('dedupe_key', m ->> 'dedupe_key', 'title', m ->> 'title', 'outcome', 'duplicate');
    end;
  end loop;

  if approved_n > 0 and topic_was is distinct from 'approved' then
    update public.dosje_topics set status = 'approved', updated_at = now() where slug = t ->> 'slug';
  end if;

  return jsonb_build_object(
    'topic', t ->> 'slug',
    'topic_status', case when approved_n > 0 then 'approved' else topic_was end,
    'topic_was', topic_was,
    'approved', approved_n,
    'results', results
  );
end;
$$;

revoke all on function public.dosje_publish_bundle(jsonb) from public, anon, authenticated;
grant execute on function public.dosje_publish_bundle(jsonb) to service_role;

notify pgrst, 'reload schema';
