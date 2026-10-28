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

## Asset reference-page exclusion

The 23:00 Warsaw run exposed CryptoSlate `/coins/bitcoin` and `/coins/ethereum`
reference pages in the candidate pool. Topic policy now rejects that exact
publisher route as publication input while leaving retrieval, ordinary reports
and nested news routes intact. The regression uses the observed routes plus
nearby valid news routes. The existing cache-reuse test also now aligns wall
time with its fixed publication fixture so advancing calendar dates cannot
silently turn a cache test into an expired-queue test.

## Reader value and bounded parallel repair — 27 October

The 26 October final run had 43 photo-qualified candidates and 19 drafts but
published 11. The first independent review finished after the replacement
cutoff. The 27 October 10:00 Warsaw run again reached its repair deadline
before completing a grouped repair. These are production symptoms, not just
synthetic failures.

Selection now carries an auditable headline/genre reader-value priority through
discovery, grounded-evidence preparation and scoped writer briefs. Within the
same freshness band, concrete costs, services, safety, rights, public decisions,
market moves, results and cultural releases precede generic announcements.
Independent-family coverage remains a secondary signal. This is a heuristic;
it is not measured engagement or proof that an article is viral. Freshness,
readability, corroboration, category restrictions and all publication gates
remain. Lower-ranked candidates remain in retrieval and reserve inventories.

Repairs now isolate only the defective articles and matching source evidence,
then reuse the existing parallel editor with one article per request. Passing
articles are restored unchanged by the existing preservation check. Global
repair/publication deadlines and independent review remain. This removes the
all-defects-in-one-model-call bottleneck; it does not certify a future quota.

The isolated Linux regression run passed 217 tests, including native shell
coordination with one-article chunks and matching evidence, without model
calls or publication. Focused Windows tests and the production build passed.

## Cross-language retelling priority

The 27 October 10:00 Warsaw run spent writing/editor time on three already
published stories. The early attention check compared English original text
with Albanian output and missed these. Published-record reads now include the
original URL and category. The prefilter also compares each lead against the
already retrieved source text for prior publications in its own category.
This uses the current inventory, makes no extra publisher requests, and demotes
rather than deletes possible updates. Missing/restricted cache entries retain
the prior fallback. The final independent deduplication gate remains mandatory.

A read-only replay against 144 recent live publications and 420 candidates
found cached originals for 80 publications. The added comparison demoted nine
additional likely retellings across five categories without deleting any
candidate or making model/publisher requests. The live PostgREST read with
original URL/category succeeded. All 56 affected Linux tests and the build
passed. Real Luna/max repair QA retained one of two previously defective
production drafts in 242.3 seconds with zero remaining copy diagnostics and
no publication; the other request timed out. This does not establish full
hourly per-category output.

## Reserve genres after live candidate review

The first new discovery pool exposed explicit transfer-rumour feeds, numbered
lifestyle lists and investment-buying advice above factual developments.
Reader priority now demotes those genres while retaining them as reserves.
Numbered tax, pension and security explainers retain practical-value priority;
a number in a useful public-service headline is not itself a penalty. The
observed source headlines and positive counterexamples pass the 39 affected
Windows and Linux tests. No publication rule, source access or photo policy
was weakened.

## Reproduced on-demand/simultaneous-release false rejection

The 12:00 Warsaw run's Economy draft stated that Channel 4 titles would be
available in Disney+ on demand at the same time as broadcast. The publisher
framing detector joined `sipas kërkesës` with `në të njëjtën kohë` and falsely
reported a Koha attribution. A regression reproduced that rejection before
the fix. Only the unambiguous simultaneous-time phrase is masked; actual
Koha credit elsewhere in the same text remains rejected. All 27 affected
native Linux tests pass, including real shell coordination. The build passed.

## Fresh-source dispatch with durable backlog turns, 27 October

The 14:00 Warsaw run had photo-qualified source-ready candidates in all seven
categories (4/6/11/5/4/3/4), but published zero after the Codex OAuth account
reported usage exhaustion. This is not a quota success. Luna/max and OAuth-only
execution remain mandatory. The owner reversed the proposed fifteen-year
portrait exception: archive portraits remain limited to 730 days. No age change
was implemented.

A read-only inspection found 25 October articles ahead of fresh 27 October
discoveries at the same queue priority. Retrieval now sorts by source publication
hint (as an instant), then latest sighting for undated URLs, while retaining the
existing index priority and per-publisher rotation. Every fifth actual article
request for each publisher selects its oldest ready task. The request counter
persists across collector restarts. Cached hits do not consume request turns;
backoff, publisher ownership, durable URLs and checkpoint requirements remain.
An expression index avoids repeatedly sorting the pending queue. These dates
order retrieval only; publication still verifies the source article timestamp.

On a private copy of 51,513 live tasks, with index tasks removed only from the
replay copies to isolate article scheduling, the next 150 dispatches contained
74 dated-within-24-hours articles before and 129 after. Median dated age fell
from 23.55 hours to 0.61 hours. Replay elapsed time fell from 33.169 seconds to
2.636 seconds. This comparison made no publisher requests, model calls,
publications or live database writes; it is queue-order evidence, not proof of
publication or exhaustive retrieval. All 236 Linux regression tests and the
production build passed. Direct review found no actionable introduced defect.

## Verified Shkodër headline rejected by missing case aliases

The 15:00 Warsaw run rejected the headline `Taulant Hoti plagoset me armë në
Shtoj të Shkodrës` because the local-location matcher knew only `shkoder`.
The standard case forms `shkodres` and `shkodren` are now explicit aliases
for Shkodër, shared by deterministic city inference and headline checks.
The regression fails before the change and passes afterward. A negative
case keeps the personal name Shkodran Mustafi from becoming a city match;
the fix does not add a loose `shkodr` stem. Other headline, evidence and
category requirements remain. All 237 Linux tests and the production build
passed. This correction
does not modify the active run or reinstate its rejected article mid-run.

## Recognize Albanian TV-series cases after live review, 28 October

The 17:00 UTC run dropped `Emma Corrin luan Elizabeth Bennet në serialin
Pride and Prejudice` because the culture-subject matcher omitted the Albanian
word for a TV series. Recognize only the definite forms `seriali`, `serialin`
and `serialit`; avoid a broad `serial` stem that would also match crime reports
or product serial numbers. The observed headline fails the regression before
the fix. All 41 source-policy/topic tests pass on Windows and Linux afterward,
including the negative crime and banknote cases. The production build passes,
and the independent review reports no findings. This change does not reinstate
the rejected draft in the active run or bypass its other publication gates.

## Isolate final event comparisons after the first reviewer release

The first actual run on `2a92617d` published six fully audited articles. Its
final reviewer compared ten finished drafts against 248 recent publications;
one four-target request timed out and held all four drafts, while the other
requests completed. Supply only the complete draft prefix through each target,
and give each target its own comparison request. Preserve every preceding
sibling, all selected historical bodies, six concurrent workers, the shared
180-second deadline and hash-bound receipts. Missing decisions still hold copy.

Both regressions failed before the corrections: later drafts must be omitted
without losing any preceding sibling, and one timed-out comparison must hold
only its own target. All 101 relevant tests pass on Windows and Linux, the build
passes, and independent review reports no findings. Prefix trimming alone still
timed out in a native replay of the first request; it is not evidence that the
timing problem is solved. Neither tests nor replays establish 20 publications
or complete category coverage. The active hourly run is preserved.

The final per-target native replay completed all ten valid comparisons against
the exact 248 archived records in 148.67 seconds, within the unchanged
180-second limit. It held two same-event retellings (the Superiore round recap
and Israeli coalition arithmetic) and approved eight, including two useful
stories lost to the original timeout. No live records, publication state or
emails were changed by the replay. This is a measured replay result, not an
hourly publication count or a timing guarantee.
