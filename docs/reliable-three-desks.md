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
- Pending: captured replay, real Luna validation,
  independent reviews, Linux checks/build, committed GitHub release, and three
  scheduled production observations with visual article reports.

Tests use the agreed public boundaries: discovery/readability, ranking/eligibility,
category-run outcomes, and publication/readback. Test-double output is not evidence
of Luna latency, writing quality or actual publication. No publication target has
yet been established by this implementation.

## Recovery and safety contract

Unapproved progress has separate storage and a policy version; it cannot satisfy
publication. Bind unchanged source/note files and saved batch/evidence bytes.
Pending recovery respects source freshness (one hour for time-sensitive work,
otherwise 24 hours). Approved reserves retain the existing source age under
24 hours and approval age under six hours, or one hour for time-sensitive work.
Preserve one fresh rewrite, final original-photo verification,
publication locking and exact persisted-copy readback. Explicit writer declines,
editor drops and terminal originality/context rejections do not resume as approvals.
Quota stops new model work and still finalizes completed approved deliveries.

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
Luna/max live dry runs are in progress in World → Showbiz → Economy order.
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
