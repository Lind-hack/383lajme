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
Respect source freshness (one hour for time-sensitive work, otherwise 24 hours),
existing approval expiry, one fresh rewrite, final original-photo verification,
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
Linux checks, current production build and live Luna validations must follow.
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
