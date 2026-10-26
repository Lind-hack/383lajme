# Për ty reading-loop measurement

## Run the localhost demo

```sh
# Build once if this checkout has no .next/BUILD_ID.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-preview-placeholder npm run build
npm run demo:per-ty
```

Open `http://localhost:43183/per-ty`. Set `PERTY_DEMO_PORT` to use another port.
The launcher runs the compiled application with a disposable sample database and
an isolated copy of its build cache. It does not modify the repository database.
External API actions and third-party analytics are disabled in this demo.

1. Click **Enable demo analytics**, then finish onboarding with **Kosovë** selected.
2. Read each summary for four seconds, or open its article and return. The edition
   progresses to completion using the real application code.
3. Open **Captured events & report** to see local starts and completions.
4. Click **Tomorrow →** to return as the same browser with fresh daily progress.
   Click it again to close that return day and see a mature D+1 rate in the report.
5. Click **Reset demo** to clear this demo's reading choices and captured events.

Events are stored only in the local demo process's memory. The real production
report remains credential-protected. Stop the launcher with Ctrl+C to remove its
temporary runtime. This command does not deploy anything.

The live launcher was browser-verified through summary completion (1/1), opening
a real sample article from its isolated database, next-day progress reset (0/4),
mature next-day return (1/1), and reset back to onboarding with no captured events.
The 15 reading-loop, daily-history and usage-validation tests also passed.

The weekly goal is a reader choosing follows, opening a bounded edition,
finishing it and opening another edition the next Kosovo day. Newsletter
activation is a separate channel, not a prerequisite.

## Definitions and report

`perty:follow`, `perty:start`, and `perty:complete` reuse the existing
consent-gated `/api/analytics/usage` endpoint and `site_usage_events` table.
No migration is needed. Completion marks expire at Kosovo midnight; historical
read marks remain available for personalization. The browser shares the existing anonymous visitor/session
IDs; the server hashes them. No chosen topics, names, towns or account IDs are
added. Denying analytics sends no loop events. Accepting while an edition is
already open starts measurement then; earlier actions are not backfilled.

A start requires saved interests and a nonempty personal edition. A completion
means every personal-edition item was opened that local day or its summary/excerpt stayed at
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

Read-only subscriber/receipt queries for an authorized database operator:

```sql
select count(*) as active_subscribers
from public.newsletter_subscribers where status = 'active';
select issue_id, status, count(*) as deliveries
from public.newsletter_deliveries
where issue_id = '2026-10-25'
group by issue_id, status;
```

The connected GitHub integration subsequently permitted a manual rerun of the
existing `send` job in run `40292835419`, attempt 2, job `121870695542` at
21:52 UTC on 26 October. It completed successfully and returned
`outside_weekly_window`, issue null, sent 0, failed 0, pending 0, held 0.
No new issue or delivery was forced. This resolves manual execution verification;
it does not verify an actual send or reveal audience size.

Remaining operational work: an operator with database access must capture active
subscriber count and inspect cumulative delivery/queue receipts. An actual send
must still respect the normal delivery window and consent. The manual rerun
verified production authentication and endpoint execution only.

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
5. Historical read marks could incorrectly satisfy a new day. A separate
   bounded daily read record now controls completion.
6. A failed WebGL shader allocation could crash mascot animation in onboarding.
   Shader/program allocation failures now leave the still-image fallback visible.
7. Restoring an existing feed could leave its read markers stale. Page-show and
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


## Verification evidence from this branch

Production mobile browser: guest onboarding → choose Kosovë → open personal
edition → open its first article → back to the edition passed. The article's
read marker persisted. Browser analytics consent was denied for this production
check. No newsletter subscribers, push subscriptions or production database rows
were added by the browser test.

The default Node 20 test invocation cannot expand the repository's quoted test
globs and cannot import its existing TypeScript test subjects. The complete suite
passes under Node 24; no package configuration was changed for that environment
limitation. There is no separate lint script in package.json.

The first build passed compilation and TypeScript, then failed on the existing
Tregu page because the unattended environment has no public Supabase settings.
The final build uses a loopback URL and a non-secret placeholder public key;
it has no production service-role credentials. Browser verification against
that compiled preview intercepts analytics ingestion, so it verifies payloads
and consent behavior, not persistence in the production analytics database.

Final automated verification: all 1,438 repository tests passed under Node 24.
`npm run build` passed, including TypeScript and both deployment-guard hooks,
with the local placeholder Supabase configuration described above. Expected
unavailable-data fallback logs and the existing middleware-deprecation warning
remain. No deployment was performed.

Compiled mobile preview passed with four published disposable fixture stories:

- Onboarding saved follows; the captured payloads contained one follow, one start
  and one completion milestone after all four summaries were read in place.
- Completion persisted on reload. Advancing the browser clock to the next Kosovo
  day preserved visitor identity and cleared the prior day's completion.
- Denied consent sent no milestones; granting consent after opening the edition
  emitted the start milestone.
- Forcing WebGL shader allocation to return null produced no page errors and kept
  onboarding usable with its still-image fallback.
- Local HTTP checks returned 401 for the private report without authorization and
  403 for usage ingestion from a foreign origin.

Setup failures were corrected before this check: the original local database had
unpublished rows without slugs and therefore correctly produced an empty edition;
the preview used explicit published fixtures instead. Initial browser launch needed
ARM Chromium and its missing shared libraries, installed only under `/tmp`.
Temporary fixture data and generated type/build metadata were restored before commit.
