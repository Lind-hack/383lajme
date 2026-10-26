# News throughput follow-up — 26 October 2026

The requirement remains 2–3 fresh, verified articles in every category each
hour, with mandatory contextual photos. No scheduled run has proved that
requirement complete. Source retrieval and photo-ready/draft counts are not
publication counts.

## Reproduced losses and corrections

- A WNBA start time written as “sipas kohës lindore” was falsely identified as
  Koha attribution. Explicit time-zone phrases now pass; actual outlet credit
  still fails, including when the same sentence contains a time zone.
- “Kënga e Ella Langley…” failed the Showbiz topic check after editing. Albanian
  song noun forms now identify culture; unrelated bank stories still fail.
- A Bitcoin moving-average headline lost its exact curated BTC photo match
  because the market detector did not recognize the indicator. Moving averages
  now qualify; wrong assets, forks, company shares and software releases do not.
- The first editor previously received only originality feedback, then spent
  a later repair round discovering journalism/title/topic defects. The first
  request now receives all three existing gate results, tied to exact titles
  and URLs. Preflight does not mutate or prune drafts; final gates remain.

## Verification

Regression cases failed before the corrections and passed afterward. The Linux
worker QA environment passed 108 related tests, 9 topic-selection tests and the
real shell prompt-expansion test. Shell syntax checks passed. Replaying the
saved 19:00 UTC writer snapshot reproduced two time-zone fixes and the BTC
photo-match fix; the actual edited song headline also passes. Preflight
identified six drafts needing early correction in that 16-draft snapshot.
This replay made no model calls or publications.
The production build passed after installing the locked optional dependencies,
rebuilding the local SQLite binding and supplying ignored public Supabase build
settings. No dependency manifest or lockfile changes were needed. Direct
review of the complete implementation and regression-test diff found no
remaining actionable regressions.

## Remaining work

Deployment/worker activation and the next full scheduled run require direct
verification. Category photo supply, deadline losses and rejected or exhausted
stories still constrain output. All 96 registered publishers are attempted,
but publisher access refusals and technical failures prevent confirmed
exhaustive retrieval. The owner has no additional approved access. Outlet
images are not treated as licensed merely because they appear on an article.
Do not mark the full objective complete from these regression results.

## Source-photo reuse follow-up

International desks now retain a source-matching Commons photo when the
pipeline independently verifies its permitted licence, creator, source page,
exact bytes, size and visual relevance. Exact Commons source URLs are looked
up directly, including thumbnails, rather than relying only on subject search.
They are not treated as independently grounded Wikipedia lead images. Other
publisher images are not presumed licensed. Matching options are offered first
to the native photo editor, retain archive/illustration captions and record
`source_image_reuse=true`, `distinct_from_source=false` truthfully.

Kosovë and Shqipëri still refuse source-matching Commons photos; the existing
institutional press-photo policy is unchanged. Batch uniqueness and native
pixel review remain mandatory. Tests cover all five international categories,
both local categories, malformed or unlicensed inputs, thumbnails, final
category changes, the option cap and the original photo comparison rules.

The real Luna/max editor QA on three saved production drafts returned three
verified decisions in 259.2 seconds without publication. Its edited Showbiz
headline used “hiti” and “Hot 100”, exposing another missing culture vocabulary
case; the follow-up adds those and “singëll” alongside song inflections.
This is still not evidence that every production category meets the quota.
The combined Linux regression suite passed 170 tests and the production build
passed. A final deterministic replay of the three real editor decisions has
zero remaining copy diagnostics and retains the exact BTC asset match.

## Freshness priority

A 20:31 UTC inventory audit found unused readable candidates from the last
three hours in every category (Kosovë 20, Shqipëri 13, Sport 10, Teknologji 18,
Ekonomi 12, Botë 42, Showbiz 13). They are not necessarily distinct events or
approved articles. Selection now prioritizes the last three source-publication
hours, then six, before older reserves within otherwise comparable coverage
and quality. The same priority survives photo preparation and desk briefs.
Publication timestamps on 383 and sitemap modification dates are not used as
source freshness. The durable retrieval inventory is not truncated or purged.
The combined Linux suite passes 181 tests, including UTC-offset boundaries,
missing dates, modification-date rejection and preservation of older reserves
through the scoped writer brief. The production build passes.

## Release verification availability

Railway's GitHub deployment of `881c20b8` stopped in prebuild because GitHub's
REST head check returned HTTP 403. A fallback now verifies the same exact
`refs/heads/main` through GitHub's public smart-Git advertisement, only after
REST 403/429. It keeps the existing repository/branch/integration metadata and
exact SHA checks. Malformed, missing, conflicting, case-mismatched or stale
refs fail closed; no token is forwarded to the public Git transport. Local
live Git transport and `git ls-remote` agreed. The 12 guard tests pass.

## Quota outcome reporting

The 21:00 and 22:00 Warsaw runs hit explicit OAuth account exhaustion. Bare
command errors reached `on_error` without using the existing model-quota
completion path. The handler now routes those errors through `fail_run`;
ordinary infrastructure errors and optional review failures keep their
existing behavior. Already published batches remain published. Three native
shell integration tests exercise the real handlers without model, mail or
database requests. This reports quota honestly; it does not create capacity
or publish unreviewed drafts.
