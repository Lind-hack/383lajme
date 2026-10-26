# Për ty reading-loop measurement

The weekly goal is a reader choosing follows, opening a bounded edition,
finishing it and opening another edition the next Kosovo day. Newsletter
activation is a separate channel, not a prerequisite.

## Definitions and report

`perty:follow`, `perty:start`, and `perty:complete` reuse the existing
consent-gated `/api/analytics/usage` endpoint and `site_usage_events` table.
No migration is needed. The browser shares the existing anonymous visitor/session
IDs; the server hashes them. No chosen topics, names, towns or account IDs are
added. Denying analytics sends no loop events. Accepting while an edition is
already open starts measurement then; earlier actions are not backfilled.

A start requires saved interests and a nonempty personal edition. A completion
means every personal-edition item was opened or its summary/excerpt stayed at
least half visible for four continuous seconds in a visible, focused tab.
This is a reading proxy, not proof that full articles were read. Must-know
stories and folded extras do not enter its denominator. `perty_end` in GA4
continues to mean only that the end card was visible.

The protected report is `GET /api/analytics/usage?report=per-ty`, using the
existing `Authorization: Bearer <CRON_SECRET>` authentication. The read-only
operator command is:

```sh
# Supply CRON_SECRET through the operator's normal environment, never in git.
node scripts/per-ty-retention-report.mjs > /private/path/per-ty-cohorts.json
```

The report contains one cohort per observed Kosovo calendar day, deduplicated
by anonymous browser, with these counts and denominators:

- Follow → start: browsers following and starting that day / browsers following.
- Completion: starters completing that day / starters that day.
- Next-day return: starters opening an edition on D+1 / starters on D.
- Return after completion: completers opening an edition on D+1 / completers on D.
- Historical visit-only return: page visitors on both D and D+1 / page visitors on D.

These are daily activity cohorts, not first-ever acquisition cohorts or people.
A browser may belong to multiple days; clearing storage or switching devices
breaks identity. History lasts seven days under the existing retention policy.
Rates with no denominator are null. D+1 rates remain pending until the entire
next local day ends, including across DST. Counts reflect consenting browsers
only and may be lost to connectivity failures or blockers. Event timestamps
are server receipt times. The report paginates the database and fails explicitly
rather than returning a partial denominator if its event limit is exceeded.

Historical page visits cannot reconstruct completion. After release, allow two
complete local days before interpreting the first mature return cohort. Export
the report on Friday and preserve it privately before the seven-day history expires.
No scheduled jobs are installed by this change.

## Initial production baseline audit — 26 October 2026

| Measure | Observed result |
| --- | --- |
| Personal edition starts / completions | Not previously recorded in the usage table; unavailable before this release. |
| Next-day edition returns | No measured baseline yet; do not substitute page views or synthetic tests. |
| Historical visit-only return | Report supports existing page events; production extraction blocked by unavailable analytics credential. |
| Newsletter active subscribers | Unknown: no authorized database access in this process. Zero new sends does not imply zero subscribers. |

The service configuration files `/etc/383-newsletter-schedule.json` and
`/etc/383-newsletter.json` are root/newsletter-readable; the unattended agent
runs as `agent` and receives `PermissionError`. Credentials were not printed
or copied. The available GitHub token can read runs but manual dispatch of
`weekly-newsletter.yml` returned HTTP 403, `Resource not accessible by personal
access token`. No credential or schedule was changed and no window was bypassed.

Read-only run evidence:

- [25 October 12:57 UTC](https://github.com/Lind-hack/383lajme/actions/runs/40195408315):
  issue `2026-10-25`, sent 0, queued 0, failed 0, pending 0, held 0.
- [25 October 19:30 UTC](https://github.com/Lind-hack/383lajme/actions/runs/40226389966):
  same issue and counts. These are per-request counts, not cumulative delivery receipts.
- [26 October 08:31 UTC](https://github.com/Lind-hack/383lajme/actions/runs/40292835419):
  `outside_weekly_window`, sent 0. A green run does not prove inbox delivery.

Remaining operational work: an operator with Actions write permission must run
the existing workflow once and capture its response; an operator with database
access must capture active subscriber count and inspect cumulative delivery/queue
receipts. A manual run outside the weekly window verifies authentication and
execution only. Real mail must still respect the normal delivery window and consent.

## Failures found and fixes

1. Reading summaries in place did not update edition progress. Summary/excerpt
   dwell now updates the same stored read markers as opening an article.
2. There was no distinct edition completion event in the usage store. Starts,
   completion and saved-follow actions now have a closed event vocabulary.
3. Updating read markers could recompute the must-know band and replace edition
   items mid-visit. Must-know selection now uses the visit's initial read snapshot.
4. Visibility timers could count a background tab or less than half a row.
   They now require a focused visible tab and intersection ratio of at least 0.5,
   resetting the timer on blur or loss of visibility.
5. Restoring an existing feed could leave its read markers stale. Page-show and
   focus now refresh stored reads.

## Verification procedure

Use a local preview with disposable stories and no production credentials.
Choose topics through onboarding, finish setup, and check that the edition has
items. Observe its `perty:start` request after consenting. Read each summary for
four seconds, scrolling it at least halfway into view, and verify progress and
`perty:complete`. Reload and confirm follows and read marks persist. Repeat with
analytics denied and confirm no loop payload is sent. Move a browser test clock
forward one Kosovo day and reopen the edition; the visitor must remain stable.
Use timestamped report fixtures for D+1 eligibility, duplicates, missing return
days and the October DST boundary. Synthetic results are not production cohorts.
