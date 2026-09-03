-- A citation whose live url has died is still verifiable, but only if the
-- reader is handed the snapshot that was actually read.
--
-- Measured on the "Resolution 1244" subject: four of the seven urls Wikipedia
-- cites are dead, and three of those four are un.org -- the Tier 1
-- primary-document host. Before the fetcher fell back to the Wayback Machine
-- those four returned empty text, the model had nothing to quote, every draft
-- failed validateMilestoneDraft, and the research route answered 422
-- verify_failed. Recovery takes that subject from three usable sources to
-- seven, and from two distinct publishers to three.
--
-- url stays canonical: publisher and tier are properties of who published the
-- claim, not of where a copy was read. Rewriting url to web.archive.org would
-- collapse every recovered source into one publisher and permanently disarm
-- the two-publisher rule.
alter table public.dosje_citations
  add column if not exists archive_url text
    check (archive_url is null or archive_url ~ '^https://');

comment on column public.dosje_citations.archive_url is
  'Wayback snapshot actually read when the live url did not resolve. Null when the live url served the text.';
