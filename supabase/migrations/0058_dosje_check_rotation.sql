-- 0058 — Separate "when we last looked" from "when it last answered".
--
-- The weekly re-check ordered by last_ok_at and only advanced it on success,
-- so a permanently dead link stayed sorted first forever. Once the corpses
-- outnumbered the weekly slice, the job spent every run re-fetching the same
-- dead urls and no living citation was ever checked again — the rot detector
-- itself rotting, quietly, while reporting a clean pass.
--
-- The obvious fix, stamping last_ok_at on failure too, would have been worse:
-- that column is shown to the reader as the date this source last answered.
-- Advancing it on a failure would print a fresh verification date beside a
-- dead link, which is the exact class of false assurance this feature exists
-- to remove. So the two facts get two columns.

alter table public.dosje_citations
  add column if not exists last_checked_at timestamptz;

comment on column public.dosje_citations.last_checked_at is
  'When this url was last fetched, whether it answered or not. Orders the re-check rotation. Never shown to a reader — last_ok_at is the honest one.';

-- Existing rows: they were last looked at when they last answered.
update public.dosje_citations
   set last_checked_at = coalesce(last_checked_at, last_ok_at, fetched_at)
 where last_checked_at is null;

drop index if exists dosje_citations_recheck;
create index if not exists dosje_citations_rotation
  on public.dosje_citations (last_checked_at nulls first);

do $$
declare
  n int;
begin
  select count(*) into n from public.dosje_citations where last_checked_at is null;
  raise notice 'dosje_citations rotation column ready; % rows still unchecked (they sort first, which is correct)', n;
end;
$$;
