# News throughput: 24 October review checkpoint

## Evidence and implementation

- Five independent research dimensions and a full-report synthesis identified
  reserve attrition, recovery/quota handling, and acceptance verification as the
  highest-impact problems. Reports are retained in the task's research artifacts.
- Retain unrequested photo-qualified reserves on the existing complete verified
  evidence fallback. Requested-note failure handling remains distinct. Real
  19:00 inventory replay retains all 76 qualified records instead of 40, with
  identical image records, no model calls and no database writes.
- Prefer explicitly labelled public-event material before exclusive, opinion,
  gallery or betting material using non-discarding warnings. Close the measured
  skiing category leak without excluding unrelated resort investment stories.
- Apply the existing semantic detector and uncertain-development judge to pending
  siblings as well as published stories. Preserve first/previously approved copy,
  recheck the final merged batch, and reject clear repeats before database writes.
- Verify database rows by article ID against reviewed content, category, dates,
  image URL/dimensions and raw provenance. A read-only check of all nine actual
  18:00 rows passed this stronger comparison.
- Stop new model processes after explicit account exhaustion; ordinary transient
  HTTP429s retain retries. Markers are scoped to the hourly invocation and reset
  only after acquiring the publisher lock and checking completed state.
- Record quota outcomes as zero publications and send one existing-format completion
  notification. An existing published slot cannot become a quota/no-news outcome.
- Permit bounded fresh replacement starts through minute43, still ending writers
  at minute45 and review at minute50. Rewrites keep the earlier cutoff.

## Direct review and validation

Root directly inspected the complete changes and call sites using review-agent
and code-review-and-quality. Two reproduced defects were addressed: initial asset
metadata cache reads during the first half hour after reboot, and quota outcome
classification after publication. No remaining actionable regressions were found
in this reviewed change set.

- Combined Linux checks: 355 passed. After the final published-state guard change,
  all 17 targeted Linux orchestration checks passed.
- Windows targeted orchestration: 17 passed. One earlier run timed out under local
  build load; the isolated/complete rerun passed, as did the actual Linux checks.
- Production build passed before merging subsequently advanced main. Rebuild and
  relevant frontend checks are required on the merged release before pushing it.
- No article approval receipts were fabricated and no QA drafts were published.

## Acceptance still outstanding

The goal is not complete. The 18:00 run published nine articles, with missing
Shqipëri/Sport and only one Showbiz article. The 19:00 run encountered actual
OAuth account exhaustion. The 20:00 run failed independent originality review;
its ten candidates were not published. The 21:00–23:00 runs also exhausted the
account allowance. The reviewed reserve/integrity changes became active in worker
fdfe2129 at 23:45 UTC, after those slots. Do not count those earlier outcomes as
acceptance of the new worker.

After release, require exact production SHA/source/ref, idle-lock worker activation,
and two scheduled runs with two to three genuinely verified articles in every
category and qualifying photos. Process completion and deployment health alone
do not satisfy those publication criteria.

## Merged release validation

Merged the two newer main commits for Për ty without conflicts or edits to their
features. Their 59 relevant frontend checks and the merged production build passed.
The final published-state safeguard also passed all 17 Linux orchestration checks.
The staged release remains subject to Railway exact-SHA verification and idle-lock
activation; live all-category publication acceptance is still outstanding.

## Native photo inspection, 25 October

The photo editor now receives actual contact-sheet pixels in its existing Luna
calls. Each eight-story chunk offers at most eight images per story, preserving
available tiers. Downloads retain the existing public-address, redirect and size
checks; six downloads run concurrently, with a 128-thumbnail process-local cache.
Unseen, unreadable or unreviewed images cannot fall back to metadata approval.

The isolated subprocess requires openai-codex, gpt-6-luna and max effort, disables
tools and aborts auxiliary vision and image stripping. It checks the exact image
digest in the outgoing Codex request. A positive verdict records the original
image and contact-sheet digests. Final photo/video qualification re-fetches the
image and requires matching bytes and a current review record; publication checks
the retained record. Provider or runtime incompatibility fails closed.

Direct review found and fixed an early qualification gap: checking only the source
digest could retain a malformed review until the final publication gate. Both
photo and video qualification now validate the complete native review record.

Validation:

- Live opaque-image probe: Luna identified the Ethereum token, moss and grass;
  the outgoing image digest/provider/model/max checks passed.
- Real two-story contact fixture: Ethereum photo accepted, federation results
  graphic and unrelated subject refused, in 11.1 seconds.
- Dense eight-story / 64-cell fixture: all eight exact-asset and results-graphic
  checks passed in 34.2 seconds, including multiple fitting alternatives.
- These QA fixtures wrote no articles or publication approvals.
- Combined Linux news/source/hourly/originality/publication checks: 362 passed
  before the final stricter review-record validation; targeted checks cover that
  validation and both photo/video poster qualification.
- After that validation change, all 58 targeted Linux contact/image/video checks
  passed. The final production build passed. Direct read-only review of the
  complete native change, tests and call sites found no remaining actionable
  regressions; live hourly coverage and account capacity remain unproven.

Native pixel inspection is an image-quality safeguard, not evidence that all
seven desks now meet their hourly publication floor. Scheduled acceptance remains
required, including verification against complete reviewed database rows.
