# Balanced news throughput checklist

- [x] Inspect current main and live runtime, source health and per-category losses.
- [x] Research five independent dimensions and inspect an official scraping skill.
- [x] Confirm mandatory photos and permission for relevant cross-batch photo reuse.
- [x] Repair article-date extraction and expose source-content diagnostics.
- [x] Repair grounded photo subjects and rights-safe alternative subjects.
- [x] Implement two-to-three category allocation, honest shortages and productive refill.
- [x] Enforce Luna/max/Codex OAuth without API fallback and bounded work.
- [x] Verify empty editorial results and optional rounds preserve approved work.
- [x] Review full changes; run source, photo, editorial, publication and scheduling tests plus build.
- [ ] Push intended clean changes to main; verify Railway production SHA/source.
- [x] Install committed versioned worker without interrupting a production run.
- [ ] Verify a full seven-desk real-source run and actual balanced production publication/category pages.

The final throughput item remains open until actual output proves it. Do not replace this with a weaker smoke-test success criterion.

## Verification 2026-10-21

- Final local suite: 188 tests, two Linux-only skips. Final Linux suite: all 188 passed, including timeout descendant cleanup and main-thread termination of model calls started by review threads.
- Rebased onto current main, preserving the concurrent article and Dosje changes; npm run build passed after rebase. Bash syntax and diff whitespace checks passed.
- Source discovery on committed release d05284c7 selected 322 current candidates across all seven categories, from 528 raw leads. 46 of 65 configured feed/listing retrievals were healthy; blocked and unavailable sources remain skipped.
- Worker commit d05284c7f144a3cdcd9ebeb58e810ed8d73a2b23 was installed from its committed Git archive and activated under the publisher lock after the previous run finished. The previous release remains available for rollback. Production database host, max reasoning, saved publication state and the 07:00-23:00 Warsaw timer were verified.
- The previous worker's 20:00 Warsaw run published four articles: two Kosovo and two Showbiz, with five desks empty. This is a baseline, not evidence of the fix's output.
- The new worker's next scheduled run is 21:00 Warsaw. Use the actual scheduled run for full real-source verification so a separate QA run does not occupy the production lock and displace an hourly slot. Balanced publication and visible category readback remain pending.
- Main received the intended news changes. Railway's official status reports builds and deployments paused during a platform outage (https://status.railway.com/). The website still reports dacf0ca834db42cc7264d5a6d91da21728f317eb, production/github-main. Do not mark the website release verified or bypass its GitHub integration.

## Follow-up from the 21:00 real run

- Source discovery: 322 selected leads; photo preparation: 17 qualified, including four Albania but only one World. Sixteen became writer-ready; the feasible publication plan is 15. This cannot meet two-per-desk yet.
- A place's single Wikipedia lead image unnecessarily exhausted place fallbacks. Added exact Commons depicts-identity search, preserving rejection of maps, namesakes, unclear rights and insufficient dimensions. Isolated read-only pilot found 31 licensed Paris candidates; Brussels remained unavailable. These are metadata candidates, not publication approvals.
- Seven note calls hit Hermes's implicit 90-second non-stream watchdog. Added Luna-only 600-second stale / 900-second request configuration in the isolated news home, plus 300-second first-byte/event watchdogs. Native Hermes resolved the intended values in a temporary config; the active production config was not changed.
- Follow-up regressions: 194 local tests passed with two Linux-only skips. Follow-up release and its real yield remain pending; do not mark balanced throughput complete.

- Further photo review found organization identities being dropped just because Wikipedia uses a logo. Identity-only resolution now retains a grounded entity/QID while excluding the logo from candidate files; actual photo qualification is unchanged. Two regressions preserve namesake/media exclusions and prove no logo reaches the image file list.

## 21:00 Warsaw outcome

- Published three: Kosovo 1, Albania 1, World 1; all three passed live HTTP/slug readback and completion mail succeeded. Sport, Technology, Economy and Showbiz remained empty. The throughput objective is not achieved.
- Follow-up commit 321e85a4 has passed 193 core Linux tests plus three configuration tests under Hermes Python; all 196 local tests passed with two Linux-only skips. Its production build passed. It remains to be activated after the completed run, then verified with real model work and the 22:00 slot.
- Worker paths are now pinned to the physical release directory so past evidence and batch paths survive a later symlink switch.

- Real three-story Luna/max note check completed all three fact sheets in 152.7 seconds after the timeout fix (no publication or email). Note work now rotates across desks before backups so a shared deadline does not starve later categories.
