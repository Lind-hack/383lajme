-- Placeholder citations stop being counted as links that died.
--
-- 0052 recorded two hand-written provenance notes as citations. The url column
-- is `not null check (url ~ '^https://')`, so the note needed a url-shaped
-- value and got `https://example.invalid/unverified`. The comment there is
-- explicit about the intent: "Recorded as provenance, not as a verified
-- citation: no url, no fetch, so it cannot satisfy the two-publisher rule."
--
-- That intent held everywhere except the job written two migrations later.
-- 0054's re-verification loop reads every row in dosje_citations and cannot
-- tell a note from a link, so it fetched a reserved hostname nightly, counted
-- the failures, and reported both rows to the newsroom as sources that had
-- newly died. The last run mailed five consecutive failures for a host that
-- has never existed and, under RFC 2606, never can.
--
-- The application half of the fix is isFetchableCitationUrl in
-- lib/dosje-sources.mjs, which keeps these out of the rotation from now on.
-- This migration clears what the loop already accumulated, so the counters
-- describe evidence rather than the bug.
--
-- The rows themselves stay. They are the only record of where two of the
-- oldest moments came from, both still 'draft'; deleting them would lose the
-- provenance and change nothing about what a reader sees. And they were always
-- excluded from the two-publisher count on their own merits — dosje_reverify
-- requires http_status = 200, which a note has never had.

update public.dosje_citations
   set fail_count = 0,
       http_status = null,
       fetched_at = null,
       last_ok_at = null
 where url !~ '^https?://'
    -- Any depth of subdomain under a reserved name, and the bare name itself.
    or url ~* '^https?://([^/@:]*\.)?(invalid|example|test|localhost)(/|:|$)';

comment on column public.dosje_citations.url is
  'The source as published. A row whose host is an RFC 2606/6761 reserved name is a provenance note, not a link: lib/dosje-sources.mjs isFetchableCitationUrl keeps it out of the link-rot rotation, and dosje_reverify never counts it toward the two-publisher rule because it can never carry http_status 200.';
