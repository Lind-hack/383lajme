-- 0120 — Readers see only article links a second reader has checked.
--
-- dosje_article_topics was written by a word matcher and read by nobody but the
-- automation. Pages matched articles to dossiers again at render time, so a U21
-- match whose scorer is called Berisha showed the Sali Berisha dossier, and a
-- Flydubai story quoting Netanyahu showed his (3 Nov 2026).
--
-- /api/automation/dosje/subjects now asks a model, per public dossier, which
-- matched articles are really about its subject and marks those method = 'llm'.
-- The site shows a dossier on an article, and an article in a dossier, only
-- for such a link. This policy lets the public (anon) client read exactly
-- those rows: checked links of approved dossiers. Slugs only; nothing private.

drop policy if exists dosje_article_topics_public_checked on public.dosje_article_topics;
create policy dosje_article_topics_public_checked
  on public.dosje_article_topics
  for select
  to anon, authenticated
  using (
    method = 'llm'
    and exists (
      select 1 from public.dosje_topics t
       where t.slug = dosje_article_topics.topic_slug
         and t.status = 'approved'
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'dosje_article_topics'
       and policyname = 'dosje_article_topics_public_checked'
  ) then
    raise exception '0120 self-check: policy missing';
  end if;
end;
$$;

notify pgrst, 'reload schema';
