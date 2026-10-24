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
OAuth account exhaustion. The 20:00 run is still active on worker5dfc0b5d.

Ordinary photo-editor calls currently see metadata. Installed Hermes supports
native images but may strip rejected images or invoke auxiliary vision. A guarded
native-only visual fixture must succeed before claiming pixel inspection. Do not
introduce another model/provider or treat text-only fallback as visual approval.

After release, require exact production SHA/source/ref, idle-lock worker activation,
and two scheduled runs with two to three genuinely verified articles in every
category and qualifying photos. Process completion and deployment health alone
do not satisfy those publication criteria.
