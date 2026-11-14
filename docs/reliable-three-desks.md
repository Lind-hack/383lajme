# Reliable World, Showbiz and Economy output

Implementation base: `9a8e4438b5a6314ebf75fbb76e8578c1766af0a6`.
The preceding Claude audit covered `2e746ef0` through that base.

Target five confirmed publications per desk/hour; minimum three when eligible
stories and services are available. Keep Luna/max core writing/reviews, the
eight-call shared fair pool, and the separate post-publication Gemini enrichment
job. Preserve unrelated work and the other four desks. AP/Bloomberg access stays
public or already authorized; blocked access never counts as successful scraping.

## Implementation and verification checkpoints

- Completed: unusable/empty ranking decisions fall back to the original queue
  and suppress further ranking model calls for that hour (regression red/green).
- Completed: ranking receives its own 240-second window, independently of visual
  review, while retaining the absolute model deadline (regression red/green).
- Completed: incomplete visual reviews remain retryable on every desk; persist at
  most two review dispatches per candidate/run and rotate fresh alternatives first.
- Completed: approved-receipt recovery includes serial, parallel and context-refresh
  layouts for all three desks. Completed preparation and unapproved draft checkpoints
  resume missing stages; terminal refusals and source changes prevent reuse.
- Completed: early published-event comparisons share the existing visual call;
  cached decisions bind complete source and published copy. Final context review remains required.
- Completed: complete fallback source context reaches all three composers, and World
  reports the agreed three-article minimum. World factual headlines allow 80 characters.
- Completed: AP article-only discovery excludes election-project backlog, fresh
  World/Europe routes and official news sitemaps are seeded, and Bloomberg robot
  challenges are not readable evidence. Source funnels cover all three desks.
- Access limitation: production probes denied AP article/section/sitemap routes
  and Bloomberg articles (403); Bloomberg latest news sitemap was readable. AP
  complete article/canonical/date/photo extraction remains unverified with current access.
  Historical AP project pages and Bloomberg verification copy are excluded from readable counts.
- Completed: release/model-profile metadata and stage wall timing (including failed calls).
- Completed: captured replay, independent reviews, Linux checks/build, and the
  committed GitHub release `67d9b51c`, verified on the website and worker.
- Pending: completion of the resumed Luna validation, activation of the recovery
  follow-up after active runs finish, and three scheduled production observations.

Tests use the agreed public boundaries: discovery/readability, ranking/eligibility,
category-run outcomes, and publication/readback. Test-double output is not evidence
of Luna latency, writing quality or actual publication. No publication target has
yet been established by this implementation.

## Recovery and safety contract

Unapproved progress has separate storage and a policy version; it cannot satisfy
publication. Bind unchanged source/note files and saved batch/evidence bytes.
Pending recovery respects source freshness (one hour for declared breaking news
and time-sensitive market data, otherwise 24 hours). A broad `fresh_development`
label limits pending checkpoint age to one hour; it does not make an otherwise
eligible routine source expire one hour after publication. Unlabelled routine
checkpoints retain their 24-hour limit. Approved reserves retain source age under
24 hours and approval age under six hours, or one hour for time-sensitive work.
Preserve one fresh rewrite, final original-photo verification,
publication locking and exact persisted-copy readback. Explicit writer declines,
editor drops and terminal originality/context rejections do not resume as approvals.
Quota stops new model work and still finalizes completed approved deliveries.
Preparation receipts bind their original readiness timestamp as well as files.
Recovery carries that timestamp into pending work, never a new recovery clock;
legacy readiness without a reliable timestamp waits for fresh preparation.
Dry-run delivery also applies the same within-run duplicate-photo check to
earlier QA-approved articles; repeated photos must not inflate validation counts.
Final independent retelling rejections are terminal and explicitly recorded as
`context_review_rejection` in desk outcomes, rather than disappearing from the
shortfall report after an otherwise successful worker exit.

The visual attempt ledger belongs to the hourly run, saves dispatch before the
model call, permits two attempts, rotates fresh alternatives first and allows
valid completed-cache reuse after a crash. Timeout is pending, never reviewed.

## Verification and release acceptance

Four agreed TDD seams: discovery/readability, ranking/eligibility, category-run
outcomes, publication/readback. One failing behavior/minimal fix per cycle.
Local relevant suite: 258 tests passed, three platform-specific skips (before
final reporting refinements). Stand-ins never establish Luna latency or prose quality.
Linux: all 261 relevant tests passed. The production build passed with existing
Supabase configuration loaded privately. Captured-receipt replay made no model
calls or publications; each desk retained five ranked candidates with matching
receipts. Stale/overwritten pixels were excluded, never called current Evals.
Luna/max validation was attempted in World → Showbiz → Economy order.
The `67e7911e` World diagnostic stopped on account quota with 168 readable
candidates, two completed Evals, one saved draft and zero approvals. Its serial
Showbiz/Economy validations did not start because the same account was exhausted.
No provider or account was substituted. This does not establish the volume goal.
Validate World, then Showbiz, then Economy with publication disabled before release.
Preserve Luna/max, eight shared fair slots, minute-50 model cutoff and minute-55
outer deadline, reader-interest rules, native photos, corroboration for sensitive
claims and Claude's separate Gemini post-publication context/media job.

Review the implementation against its starting commit using separate Standards,
Spec and defect-first reviewers. Release only a clean committed origin/main push
through the GitHub hosting integration; verify website and worker SHA. Observe
three scheduled hourly runs under shared load, report each desk separately, and
provide a visual article-rating report. Five is the target, three the conditional
minimum; unresolved pipeline failures below three are not acceptance. Editorial
appeal is an estimate; engagement remains unknown without reader measurements.

## Independent reviews

Standards: no findings. Spec and defect-first reviews identified recovery gaps
(normalization hashes, terminal writer declines, quota finalization, repeated
selection after failed recovery, preparation-time hashes and market freshness).
Each actionable issue was corrected and covered by a behavior regression; the
corrective read-only reviews found no further introduced defects.

Current live renderer validation confirmed unchanged original hero images. Its
context summary and consent-control markup exposed readback false negatives;
regressions now distinguish persisted context/UI controls from exact article
copy. No image URL transformation was restored. Final corrective checks and live
article comparisons remain to be recorded before release.

## Luna timing validation follow-up

The first real World diagnostic, pinned to `602271e6`, exposed repeated native
photo-review timeouts under concurrent production load. Live slot samples also
showed two-to-three-minute waits on some production calls; this is capacity/time
pressure, not evidence that the captured stories are unsuitable. Timeout rows
remain pending and never count as completed Evals.

A new failing public visual-review test demonstrated that the hard-coded
180-second model call could not complete a 200-second response even inside a
360-second review window. Native review now permits 240 seconds, still clipped
by the visual and absolute model deadlines. Reliable Showbiz/Economy visual
windows are 360 seconds, matching World; their collector allowance covers
ranking plus this window (840 seconds total). Eight shared slots, fair allocation,
minute-50 cutoff, minute-55 outer limit, scoring and approval gates are unchanged.
The timing test is functional evidence; actual throughput requires another
Luna run and the scheduled production observations.

## Subsequent developments and sibling comparisons

The broader Claude audit demonstrated that the 0.18 lexical sibling threshold
rejected a later central-bank rate cut after an earlier hold, before the actual
independent event reviewer could compare the developments. It now selects related
copy for comparison rather than terminally discarding drafts. Existing approved
siblings join the existing final context review, without another model stage.
For real publication the locked saved-proof/history check still requires a fresh
independent comparison when related published history changes. Dry runs compare
earlier QA-approved copies through that same context-refresh path, once per story;
retellings remain held. All factual, originality, photo, expiry and readback checks
remain mandatory. Distinct-update and QA-retelling regressions cover this path.

The first real World diagnostic (`602271e6`, 2026-11-12 19:02–19:52 Warsaw) read
231 unique candidate URLs from 16 publishers, completed four photo/article Evals,
prepared one story and saved one draft. The editor rejected it; approvals and
publications were zero. Repeated photo-review timeouts dominated the shortfall.
This is a valid failed throughput diagnostic, not a passing volume evaluation.
Follow-up Luna validation must use the corrected timing/comparison implementation.

## Public video source recovery

The rejected France24 story exposed a separate extraction defect: its public
video introduction was removed with an accessibility expander while consent,
ad-block and publication-date notices survived as purported article text.
The source reader now retains only the known public introduction and removes
those notices, without reconstructing a transcript or restricted body. The
writer labels introduction-only evidence explicitly. Extraction-policy receipts
invalidate old France24 text in inventory, visual review, preparation, pending
work and approved reserves, including corroborating evidence. Re-extraction
and independent approvals are required; old approvals are never silently edited.
Source-specific behavior tests cover hidden/restricted content and stale cache
recovery. Live runs pinned before this correction remain separate diagnostics.

The subsequent real World run also timed out a final independent context call
after originality approval. For these three desks only, both catalogue attention
and full-copy context comparisons now permit 240 seconds per call rather than
180, within their existing shared 480-second stage and absolute minute-50 cutoff.
The other four desks retain their existing call limit. A public context approval
and receipt-readback regression verifies a 200-second response for all three desks;
this simulated timing case is functional evidence, not a Luna throughput result.

Outcome finalization now merges the final collector failure before choosing its
status. A source outage with no readable supply is reported as `source_access`
and `failed`, rather than successful `no_news`/eligible-supply exhaustion.

The real World queue audit also found a directly linked cross-publisher event
pair occupying two first-wave slots. World now orders one representative of
each known direct coverage group before its alternatives, including after
reader-interest scoring. Alternatives remain eligible later in the same queue;
shared names and transitive links do not establish an event group or rejection.
Publisher rotation and all independent publication checks remain in force.

Follow-up verification: 303 relevant Linux tests passed at `82c1c076`.
The production build passed at `4fd2a498`; subsequent changes affect Python QA
bookkeeping only, with unchanged application build inputs. Standards, Spec and
defect-first corrective reviews have no remaining actionable findings. Captured
receipt replay at `23440647` made no model calls and published nothing. Actual
post-release hourly observation and remaining Luna validations are still pending.

The World composition contract explicitly restores the shared newsroom's
fact-outline-first instruction and warning against unsupported negative claims.
Repeated real originality rejections showed sentence-pair and conditional-frame
translation as a remaining loss. This strengthens composition instructions without
changing eligibility or approval gates. Its effect on first-pass acceptance and
reader appeal still requires new Luna observations; prior runs do not validate
the revised writing instruction.

The fresh image-byte check remains strict. A changed publisher response now
reports `source_image_changed`; transport/timeout failures report
`image_verification_unavailable`. Both retain the unchanged approval instead of
misclassifying the hold as publication infrastructure. Perceptual similarity
never substitutes for the approved byte hash.

World review attention also prefers a broader headline topic within each
publisher's existing turn during the first twelve choices. Three shared meaningful
headline terms with substantial overlap are an attention heuristic only: no
retelling label, score change, eligibility loss or publication quota follows.
If that publisher has no different eligible topic, its best candidate fills the
turn immediately. Every skipped alternative remains in the queue. This addresses
the observed first-wave concentration on a few already-covered topics; its effect
on confirmed hourly output remains to be measured.

### Scheduled observations and remaining recovery scheduling

Database readback for release `578ff06a` confirmed World/Showbiz/Economy counts
of `1/2/3`, `1/0/1` and `2/1/2` in the 16:00, 17:00 and 18:00 UTC runs on
13 November. These are thirteen publications, not achievement of the volume
goal. The last run was interrupted by host disk exhaustion; its running outcome
files are incomplete. Earlier shortfalls included writing/review timeouts and
serial recovery consuming the discovery window. Preserve that distinction when
assessing the conditional minimum.

Recovery now prioritizes completed review stages, deduplicates pending source
URLs, and queues up to the remaining target through at most three isolated
workers. Each worker reopens the original valid checkpoint, retaining its slot,
index, rewrite attempt and completed stages. A missing checkpoint cannot be
recreated as new work. Single-story recovery retains its existing direct path.
The eight shared model slots, image verification, independent approvals and
publication/readback safeguards remain unchanged. Functional concurrency tests
do not establish Luna throughput or article quality; new live observations are
still required for the revised scheduling.

Known published source URLs are now removed before reader-interest ranking and
photo evaluation, using the publication selector's canonical URL identity and
the already-loaded recent publication history. Tracking, fragment, `www` and
trailing-slash aliases cannot consume those model calls. A different source URL
about the same person or topic still receives the existing event comparison.
The full published-identity check and independent final context review remain
in place. Source-review reports count these exclusions separately from completed
Evals. Recovery loads existing checkpoints through a read-only path so deletion
during loading cannot manufacture new pending work.

Fresh work also queues up to the remaining five-story target, preparing at most
three candidates per chunk in separate wave directories before submitting their
jobs to the existing three-worker executor. A completed worker can start a fourth
story while slower siblings finish reviews or their one rewrite. Each job retains
its own preparation data and evidence directory; the current photo catalogue
combines their unchanged verified records, including when a later preparation
fails. Unselected candidates are not marked attempted. Preparing the second chunk
adds upfront latency, so existing quota/deadline checks still bound this work.
This closes an observed idle-worker bottleneck, not a guarantee of five approvals;
actual Luna throughput and three scheduled production runs remain to be measured.

The first three `f909790a` scheduled runs on 14 November confirmed
World/Showbiz/Economy output of `1/2/2`, `3/1/0` and `1/3/1`. These observations
do not meet the volume goal. Subsequent fixes address measured losses: Economy
recognizes electricity-production reporting without requiring a price change;
Showbiz recognizes Avril Lavigne and Travis Barker as cultural subjects without
changing audience priority. Early event triage selects its bounded complete
published comparisons using the body as well as headline/excerpt, folding names
and their case endings for attention only. Native judgments and exact passages
still determine retelling, and the final independent context check remains.
The source-triage policy version invalidates old cached decisions.

A changed source photo now blocks only its old reserve proof for that run,
leaving the story eligible for normal fresh preparation, writing and independent
approvals. The changed proof is neither consumed nor updated; a new valid proof
is required. Verification timeouts retain their existing handling. This avoids
repeatedly attempting the same invalid proof while preventing fresh evaluation
of the underlying story. Fresh image bytes, all approval hashes and confirmed
duplicate-free readback remain mandatory.

When a fresh independent reserve-context comparison explicitly rejects an old
approval as a retelling, archive that rejection against its unchanged article,
evidence and approval receipts. Storage time and expiry flags do not change that
identity, so startup receipt recovery cannot resurrect it. Preserve the original
record for audit; a materially updated story with new complete approvals remains
eligible. Uncertainty, missing verdicts and timeouts do not create terminal
rejections. This prevents repeatedly spending shared model capacity on a known
rejected reserve every hour without treating incomplete reviews as decisions.
