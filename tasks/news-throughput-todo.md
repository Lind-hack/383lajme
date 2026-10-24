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

## 22:00 and 23:00 Warsaw follow-up

- Installed worker 3ae76c22. The 22:00 slot hit the OAuth account usage limit at the writer stage and published nothing; it must not be counted as a successful balanced run. No API-billed fallback was used.
- The 23:00 slot prepared 24 writer-ready stories with a feasible 19-story plan. Writer produced 17, editor retained 11, independent review approved one World article and rejected ten for close translation or unsupported material claims. Exact publication readback succeeded. Balanced publication remains unproven.
- Confirmed installed Hermes clips each file line after 2,000 characters. Thirteen of that run's 17 primary source texts exceeded this limit (longest 14,000). Raw JSON put each source and article body on one line, hiding evidence from model review.
- Added lossless wrapped reading views for editor article input, primary/corroborating source evidence, parallel editor slices, repair evidence and independent originality review. Models are told to paginate. Original JSON, evidence digests, checks and receipt requirements remain unchanged.
- Verification: 19 focused native Linux regressions and 40 adjacent coverage/photo/dedupe regressions passed; shell syntax and production build passed. Broad Windows discovery also surfaced existing environment/legacy-test failures (newsletter cryptography dependency, startup SMTP mock and environment-dependent photo/dedupe tests); those were not counted as passes or changed in this fix.
- Railway still pauses deployments and now reports a security incident. Official notice recommends rotating credentials stored there. Website remains dacf0ca834db42cc7264d5a6d91da21728f317eb. This fix does not constitute a verified application deployment or prove the 20-article objective.

## October 22 category recovery

- Morning runs under 727264ad still published only two articles in several slots. The 13:00 Warsaw slot failed on an invalid review URL/verdict and published nothing. This contradicts the full coverage objective; it remains active.
- Isolated real-source testing found the photo model returning a story ID with Georgian lookalike letters inside “Teknologji”. Category-bearing IDs are now replaced with short ASCII IDs inside photo planning, photo selection, reporter-note and originality-review requests. Wrappers bind exact IDs back to original records, URLs and receipt hashes. No fuzzy identity matching or inferred approvals.
- Missing/malformed note, photo and review decisions get a bounded retry for only their own stories. Explicit negative photo decisions remain negative. Invalid editor source URLs are isolated from otherwise valid editor results; no new source URL is accepted.
- Fixed name extraction of “Tesla CEO Elon Musk” and recognized only verified corporate legal suffixes. Institution archive search requires a grounded Wikipedia institution type and the exact Commons depicts identity. A real TechCrunch Cybercab story went from no deterministic subject to a licensed Tesla photograph decoded at 1920x1280; after ASCII mapping the real photo editor returned a valid matching pick.
- Reporter notes now request atomic fields. One real three-desk Luna/max test produced three usable note sets (13/13/12 facts) in 205.3 seconds. Valid model notes may be reused for 24 hours only when URL, title, complete primary text and supplied corroborating text have the same hash; fragments never enter that cache and each article still passes independent checks.
- Showbiz general feeds included unrelated politics, a school shooting and diet advice. Added explicit entertainment/culture eligibility before photo research; tests exclude misleading keyword prefixes such as “authorities”, “operation”, “Romania” and “AI model”.
- Verification: 100 native Linux focused tests and 93 adjacent process, timing, source-reading, dedupe/originality and coverage tests passed. Updated source-topic regressions passed after final review. Build passed on retry after a Google Fonts connection failure. Independent read-only review of six real failed-run candidates returned six valid decisions (four approvals and two substantive copying rejections); the QA test published nothing.
- Full per-category publication, live image quality and successive scheduled runs remain required completion evidence. Test approvals or one recovered photograph are not that evidence.

## October 23 overnight verification (in progress)

- The final October 22 scheduled slot published six: Kosovo 1, Albania 2, World 2, Showbiz 1; Sport, Technology and Economy remained empty. No balanced-publication success is claimed.
- Next fixes preserve already-passing drafts during repair, exclude outlet analysis from atomic reporter notes and invalidate the old note cache. Successful entity/photo metadata lookups are cached within the current preparation process. Grounded local cities, Albanian geographic descriptions and explicitly named headquarters now survive the relevant identity checks; maps and conflicting identities remain rejected.
- Full isolated QA A started October 22 at 22:06 UTC, after the publishing window. It prepared 37 qualifying photos (K9/AL5/Sport7/Tech2/Eco6/World8/Showbiz0), then 31 usable model note sets without fragments. The writer returned 15 of its feasible 17 stories; editing and all final gates remain in progress. QA mode cannot publish or email, and production stays on its normal schedule.
- Follow-up investigation found CC0 files incorrectly rejected by the separate Commons Copyrighted flag, undersized originals occupying editor slots, and high-resolution artist photographs lacking P180 tags. The corrected path retains exact license checks and uses only the person's Wikidata-linked Commons category plus explicit filename identity. A real Raye award story then passed the photo editor and decoded a relevant licensed concert image at 1920x1081, with an archive caption. This is one photo pilot, not a complete category run.
- Additional existing-source discovery was validated from the VPS: OpenAI's official feed had one fresh article; Google AI and Anthropic were readable but had no fresh entries. Variety music, film and TV feeds returned fresh Showbiz inventory. The Hollywood Reporter and Deadline still returned restricted article pages in six real checks, so their primary-source exclusions remain in place.
- Railway's October 22 21:59 UTC update says Hobby builds are enabled again. Verify the next GitHub deployment's exact SHA; the earlier outage explanation no longer establishes a current blocker.
- Completion still requires a full real seven-category result and balanced scheduled publication with live readback. The active production worker is still 874b7b7e until the pending fixes are committed, tested and activated while idle under the publisher lock.
- Release checks for these fixes: 115 focused and 94 adjacent native Linux tests passed, including the real shell deadline helpers and the new category/repair/rights cases. Bash syntax and the production build passed. The existing Railway CLI login has been invalidated; deployment SHA verification can still use the public deployment-info endpoint after the authorized GitHub push.
- Commit a923df709eb2bcdc2431a834a5add4f59e91dfd2 reached Railway through its GitHub integration. On October 22 at 22:46 UTC, 383ks.com/api/deployment-info reported that exact SHA, production and github-main. Its worker archive is staged but the running QA publisher lock has not been disturbed.
- QA A's writer produced 15 drafts, the editor retained 12, and two preflight repairs retained 11 through originality, journalism, deduplication, topic and structural checks. Independent originality review is still running. Technology and Showbiz are absent at this point, so this run cannot establish the final coverage objective.
- Follow-up changes reduce editor chunks from five articles/three simultaneous calls to three articles/five calls, with unchanged evidence and receipt checks. A native shell integration test verifies all 15 test drafts receive their exact evidence and that a failed chunk alone is excluded. A major adult darts story had falsely matched the words "të rinj"; only an actual youth competition/team context now triggers that Albanian phrase, preserving U-age, lower-league and friendly exclusions. The 97 adjacent Linux checks and the production build passed for these changes.
- Commit 53b588e791405bbef5e120df4858d43e508ba0dd also reached the live production/github-main deployment. QA A finished with seven approved articles (K1/AL1/Sport2/Eco1/World2, Tech0/Showbiz0). It published nothing and sent no mail. Its completed batch and review receipts were preserved before QA B began; the coverage objective remains unmet.
- Expanded Showbiz's registry with NME and Pitchfork after six current public articles were independently readable from the VPS (148–816 words). Their music-news feeds are dedicated to Showbiz. Ownership families follow [NME Networks](https://nmenetworks.com/brands/nme) and [Condé Nast](https://www.condenast.com/brands/pitchfork); Pitchfork and Ars Technica therefore cannot count as independent corroborators. The full website inventory is documented in docs/news-source-inventory.md. New registry/isolation tests and the production build passed.
- QA B started October 22 around 22:50 UTC with the latest photo, repair, editor and source changes. Initial discovery selected 313 current leads, including 53 Showbiz, with 54 of 73 feed/listing retrievals healthy. All final gates are still required. Only exact-evidence policy-v2 reporter notes were carried over; QA A approval receipts were archived separately.
- QA B drafted all 18 feasible stories across seven categories, but ended with only six approved (K0/AL1/Sport2/Tech0/Eco1/World1/Showbiz1), including the bounded rewrite round. This does not meet the objective. Source-like phrasing and structure remain a substantive loss, with all rejection gates retained.
- Comparing the two preparations showed verified Albin Kurti, Prishtina and Prizren subjects being missed under a later planning deadline. The next change persists successful public entity metadata for 24 hours, revalidating each source and every actual photo. A read-only warmup completed 222/222 lookups in 28.9 seconds; reloading its saved file recovered four previously missed local subjects with HTTP deliberately disabled. A broader source-focused warmup completed 363/375 public queries; failures were excluded from the saved success cache. Neither test called a model or published anything.
- The actual OpenAI headquarters photo was being rejected because its Commons tags use a different exact-name business record and its neighborhood. A verified Wikipedia lead plus explicit Commons company-headquarters text can now accept compatible geographic/exact-name business identities. An independent Luna/max photo-editor pilot for a real readable AI-security story approved the licensed archive building photograph; decoding returned 1920x1280. Unrelated people/companies and generic category pictures remain rejected.
- Copy-editing instructions now require preserving already accurate, original prose. A private atomic writer/evidence snapshot supports diagnosing any later source-like rewriting. Current native checks passed 126 focused cases, including the snapshot shell test; the production build passed. Full next-run and production per-category verification remain open.

- October 23 release checks: 188 news tests, 18 hourly coverage/capacity tests,
  16 source-reading tests and 22 originality/journalism/topic tests passed under
  native Linux (244 total), plus the source-mix regression. Bash syntax, whitespace
  checks and npm run build passed. An initial adjacent-test invocation used the
  wrong working directory; rerunning from scripts passed all actual cases.
- The current production 14:00 Warsaw slot still ran 874b7b7e and published only
  three (Albania 1, Economy 1, World 1). No balanced success is claimed. The next
  release adds inline scoped notes, fresh replacements before rewrites, exact
  approved preservation and remaining-slot-only metadata rewrite inputs. The old
  prepared queue already stripped titles/summaries when notes existed; this is a
  scoped-input/file-read improvement, not a fix for an established source leak.
- Railway's live endpoint now confirms dda30fc88bca696182fcd2df90191c3995d74cc9,
  production/github-main. The following worker release must still be activated
  idle under the lock, then measured in a scheduled production slot. QA C is idle;
  do not occupy the lock across the next hourly production slot.

- Activated worker 06990d3b275a18be084f2e1fdf0996bf46c4a99f on October 23
  at 12:49 UTC while production was idle, holding the publisher lock. Its archive
  came from the committed Git tree. Verified physical alias, max reasoning,
  fallback_model=null, correct Supabase host and 705 valid public cache entries.
  Ten additional native direct-publication tests passed (254 tests total plus
  source-mix regression); these use mocks and did not publish test news.
- Railway's GitHub deployment for 06990d3b failed during Next.js build after
  22 seconds. Logs showed prebuild guard success and build start, then only
  generic exit code 1; no compiler diagnostic. The identical source built locally.
  Website still reports dda30fc8. Reauthenticated dashboard access is available;
  one fresh GitHub documentation push retries the committed release. Do not call
  the failed website deployment verified. Worker data publication is independent
  of app-code deployment and uses the existing validated database/API interface.

- GitHub retry a437a5525a19e2de7814637864b6637b5e60d92b reached Railway.
  The live endpoint confirmed that exact SHA, production/github-main. The worker
  remains 06990d3b; the subsequent app commit changes only this activation record.
- The 15:00 Warsaw run qualified 44 photo-backed stories across every desk
  (K10/AL5/Sport3/Tech6/Eco4/World13/Showbiz3). It made 33 reporter note sets
  (27 model, 6 fragments) and 19 drafts, with every desk initially at least two.
  After editing and all gates it published only five: K1/Sport1/Tech1/Eco2.
  Exact database category, image URL/dimensions/attribution readback passed;
  all published slugs returned HTTP 200. The completion email succeeded.
  This is not balanced-publication success. The completed batch, original
  writer snapshot, evidence, rejected copy and writing brief were preserved
  outside the active release under QA/completed-production-20261023T13.
- The first review finished at 13:39:54 UTC, past the old minute-36 optional
  cutoff. Follow-up fixes allow bounded recovery before minute 42 with a
  three-minute writer and seven-story unused, deficit-scoped replacement brief.
  Writing ends by minute 45, extra review still by minute 50 and hard run by 55.
  Source/review checks remain mandatory, and tests preserve approved articles.
- Real photo diagnostics also showed inDrive/Pony.ai being split into Drive/Pony
  and an inDrive story offered only irrelevant Uber photos. Fixed whole mixed-case
  and dotted-name extraction without bypassing grounding or relevance checks.
- Follow-up native verification: 195 news tests, 18 hourly tests, 16 source-reading
  tests and 32 gate/direct-publication tests passed (261 total), plus source-mix.
  Bash syntax, whitespace and npm run build passed. The 16:00 Warsaw run is active
  on 06990d3b; do not change its physical release. Activate the next committed
  archive only idle under the publisher lock, then verify a new scheduled run.

- The 16:00 Warsaw run prepared 33 ready stories (20 new model notes, 10 cached,
  3 fragments) with a feasible 20-story plan across every desk. Preparation left
  under four minutes for initial writing: two desk groups timed out after about
  230 seconds, so only five initial drafts returned (World 3/Economy 2). This is
  an initial-stage finding, not its final published count; editorial/recovery is
  still running on 06990d3b.
- Added a child-scoped minute-20 deadline for preparation model calls, preserving
  five minutes before initial writing's unchanged minute-25 cutoff. A real child
  process regression verifies that the parent retains its minute-50 editorial
  deadline. Native news suite now passes 196 cases (262 including the previously
  verified adjacent suites), bash/whitespace checks and production build pass.
- The saved 15:00 sports notes wrongly labeled a completed Barcelona-PSG fixture
  as a future event. Independent review correctly rejected the resulting claim.
  A proposed temporal-note pilot is prepared outside production but has not run;
  no note-generation correction is yet claimed. Do not overlap its model call
  with the active scheduled run or copy any QA approvals into production.
- Railway verified release 36be451cc2964a31929ec8ca5b86bffda3d00641 as exact live
  production/github-main. Its worker archive is staged inactive; the next archive
  must also include the new preparation deadline and be activated only while idle.

- The 16:00 Warsaw slot ultimately published two World articles and no others;
  completion mail and HTTP/slug readback succeeded. The hourly objective remains
  unmet. Its original writer snapshot and physical release artifacts remain
  available for diagnosis. Website release 497a48a25453c531843804ed63bf9411c3ef38ed
  was verified live as production/github-main; its worker is staged but inactive.
- Found and fixed a second recovery timing conflict: replacement writers allowed
  to finish at minute 44 were still sent to the initial editor's minute-43 cutoff.
  Extra editorial calls/repairs now end by minute 48, independent review and all
  extra model work still end by minute 50. A native shell regression at minute 44
  grants the extra editor 240 seconds while refusing a late initial-editor call.
- The isolated real-source temporal-note pilot returned 12 valid model notes in
  88.3 seconds, marking the PSG match completed and the Clasico/awards planned.
  Integrated that tested safeguard and raised the note-cache policy to version 3;
  old v2 notes are rebuilt rather than silently reused. No pilot published news.
- Live visual verification found PLD Space leading a published launch roundup
  whose photo shows SpaceX. New composer/editor instructions require the photo's
  subject in the actual main angle. The first isolated editor test dropped the
  mismatched article (106.9 seconds). A targeted repair attempt timed out after
  181.3 seconds, retaining its unchanged input; it is not an approved correction.
  The existing published article is still uncorrected and remains an open item:
  pld-space-miura-5-afrohet-fluturimit. Do not delete it or bypass fresh rights,
  factual and independent review to repair it. No direct publication occurred.
- Added precise matched-word feedback to the unchanged exact-overlap gate after
  two repairs failed to remove the relevant eight-word sequence in real runs.
  Native verification now passes 197 news tests plus 67 adjacent tests (264 total),
  source-mix regression and bash syntax. Final production build passed
  before the next committed worker activation. Full balanced publication and the
  specific published-photo correction remain open; do not claim completion.

- The 17:00 Warsaw slot on a29887fc published only two Kosovo articles; all
  other desks remained empty. It had 65 photo-qualified candidates but only 12
  model-produced note sets (26 fragment fallbacks), and two initial writer groups
  timed out. Independent checks and publication/readback completed; the requested
  balanced outcome remains unmet.
- Reporter-note generation now overlaps final photo HTTP downloads/decoding,
  after the photo editor has finished. Final readiness still requires successful
  photo validation; exact-source-hash policy-3 notes are reused only after that
  validation. Thread-event regressions cover overlap, failed decoding, explicit
  photo rejection and optional warmup failure.
- The actual fresh refill at 17:41 stopped after 108 seconds because it still
  inherited a minute-43 cutoff. Fresh refill now uses the same three-minute cap
  and minute-45 cutoff as rejected-story writing, with at most three selected
  stories per call. A real shell-budget regression reproduces the observed start
  time and requires the full 180 seconds. Later editing/review limits stay intact.
- Spanish metadata explicitly naming the exact company's headquarters now reaches
  normal place-photo review. The independently identified PLD Space exterior is
  CC BY-SA 4.0, dated June 2018 and decoded at 1920x1440; the change does not
  authorize its publication or repair the existing article by itself. Wrong
  company, untyped institution and invalid license remain rejected.
- Native verification: 201 news tests plus 67 previously checked adjacent tests
  (268 total), shell syntax and whitespace checks pass. Production build passed before committing this release. Real next-run publication
  counts and the PLD photo correction remain open.
- Release 2b7efd1dc1b5d2cf8759706ab2b129564a080dae was pushed to main after
  the production build passed. Railway reports success and the live deployment
  endpoint reports this exact SHA, production and github-main. Its immutable
  worker archive was activated under the publisher lock at 15:54:55 UTC while
  the service was idle; the 18:00 Warsaw slot is the first intended real run.
- The isolated Luna photo editor explicitly selected the PLD Space exterior for
  the existing article's final headline/body. Fresh independent review then
  timed out at its pre-hour deadline; no review receipt or DB correction was
  created. All QA model work ended before the next scheduled slot.
- In the 18:00 run, early notes actually started at 18:12:12 Warsaw, during photo
  HTTP finalization. They finished at 18:19:15 with 21 new model-produced sets,
  seven cache hits and ten fragment fallbacks. The final source-bound note pass
  reused all 28 validated sets; 38 stories across seven desks supported a
  feasible 20-story plan. These are preparation counts, not published counts.
- Bounded only the initial desk-group reading views to planned count plus one
  spare per desk. The global continuation/rewrite brief and authoritative
  replacement inventory remain complete. Against the actual 18:00 input, group
  sizes fell 12->8, 11->8 and 15->11 stories; reading characters fell 39%, 27%
  and 30%. Native news tests pass 203 cases (270 with the previously verified
  adjacent suites); the next production build is still running. This change is
  not in the active 18:00 worker.
- The 18:00 run ultimately published five: World 2, Economy 1, Sport 1, Albania 1;
  Kosovo/Technology/Showbiz stayed empty. Exact DB identity/category/photo/rights
  readback passed. The requested every-category outcome remains unmet. Its first
  review rejected five for originality; none of those five reasons alleged a
  factual defect. Fresh refill recovered one approved Albania article.
- Confirmed two generated photo defects: Ian Poulter's image depicts the same-named
  New Zealand school principal (Q137642272), not the golfer (Q615937); the photo
  captioned Elon Musk actually shows a SpaceX spacecraft. The latter carried an
  incorrect Commons depicts tag. Quarantined those exact generated provenance
  records, with complete backups; no worker code, draft text or receipt was
  changed. Existing mandatory-photo isolation removed the wrong-person draft.
  Repeated the exact-image-hash quarantine during the still-old 19:00 run.
- Permanent candidate validation now rejects conflicting person identities and
  requires the person's name in the file's own metadata even with a sole tag.
  Regression controls preserve a genuine same-person photo. Added explicit
  Albanian singing/television forms to culture classification; financial-only
  stories and unregistered category sources remain rejected.
- The 18:00 writer/editor comparison found body similarities of 0.249 (Quest)
  and 0.075 (Phoebe Bridgers). The editor introduced SNL background passages
  absent from the writer; the independent reviewer specifically rejected those
  added passages. Replaced the contradictory blanket rewrite instruction and
  changed initial editing to explicit source-bound decisions and exact-span
  corrections. Unaffected copy is now preserved by code; independent review is
  unchanged. Seven new tests cover exact preservation, corrections, immutable
  fields, missing checks, duplicates, ambiguous spans and atomic failure.
- Added early missing-desk recovery, capped at three parallel calls, two draft
  slots per desk, 180 seconds per call and minute 29. Native shell regressions
  verify retained initial copy, exact floor deficits, the account-call ceiling
  and no late starts. Normal initial writing still ends by minute 25.
- Latest native news suite: 216 tests pass. An additional 23 originality,
  journalism, topic and source-mix tests pass, including source-mix regression.
  A production build of these changes passed. A real isolated Luna editor pilot
  and its independent review are prepared but cannot run while the scheduled
  publisher holds the account/publisher lock. Worker activation remains pending.
- The PLD correction's fresh source/rights/decoding preflight passed again, with
  the same explicitly selected exterior image hash. The conditional PostgREST
  comparison against the entire old raw article was verified read-only. No
  correction has been applied; a fresh independent approval is still required.
- The 19:00 run finished with four published articles: World 2 and Sport 2;
  five categories stayed empty. Exact DB photo/category/rights readback passed.
  Its 14 initial drafts became four approvals; the late fresh writer timed out.
  This is another failed coverage outcome, not completion of the user's goal.
- The real isolated Luna/max pilot completed the new decision protocol with one
  retained, explicitly checked article, zero unreviewed decisions, valid schema
  and editorial completion acknowledgement. Independent review then rejected
  that sample's remaining close paraphrasing; no pilot news was published. The
  protocol is operational, but improved originality/coverage is not yet proven.
- Fresh independent review rejected the old PLD Space copy for close translation.
  The photo-only correction therefore remains blocked and unapplied. A genuine
  Luna rewrite plus fresh review is needed; do not reuse the earlier published
  approval or weaken the photo/copyright gates to apply this change.
- The 20:00 run published three articles after returning four initial drafts and
  one early recovery draft. The editor retained all five; preflight/review left
  three approved. It did not achieve the requested coverage. No success claim.
- Replaced broad multi-desk writing with seven independent two-article requests,
  maximum three concurrent, 240 seconds each, ending by minute 33. Recovery can
  run through minute 36. Native scheduling tests execute the actual Bash loop
  with SQLite-tracked local fake writers: all available desks, strict concurrency,
  isolated desk failure and zero-inventory behavior pass.
- Added explicit note origins and prioritized model/cache outlines before raw
  fragment backups in initial reading views. Added future-tense Albanian singing
  recognition. The authoritative inventory and all substantive gates remain.
- Complete inline references eliminate model file-read turns when safely sized;
  an oversize request uses complete file reads instead of truncation. The actual
  installed Hermes resolved the selected data-only toolset to zero tools.
- A real Luna/max/OAuth two-Kosovo draft benchmark completed in 193.6 seconds,
  with exact category/source scope, three paragraphs and eight factors per draft.
  A simple whitespace count reported a 137-word minimum; the official gate counts
  are 143 and 145, both above the unchanged 140-word floor. These remain unreviewed
  benchmark drafts, not publication-eligible articles or published output.
- Three isolated reviewer controls correctly approved factual reporting, rejected
  a wrong month and rejected translated distinctive imagery. One quoted span had
  a one-character typo; the separate exact imagery passage and failed exclusive-
  expression check still substantiate rejection under the existing single-
  distinctive-passage rule. The validator retains proven negative grounds and
  never turns invalid grounds into approval. No QA article was published.
- Latest native news suite: 234 cases pass. The production build passed at
  20:59:46 Warsaw. Commit 1ce71a074219c4316ea00de588ea52d2c1dd4268 was pushed to
  main and Railway deployment was verified at 21:10:37 Warsaw with that exact SHA,
  production environment and github-main source. Idle worker activation is pending;
  the already scheduled 21:00 slot remains on 76cda6b3.
- Replaying the same three reviewer decisions against the final 1ce validator
  passes all five classification/evidence checks, with zero additional model
  calls. The earlier evaluation is preserved alongside the replay report.
- The idle installer selected 1ce71a07 before the 22:00 run. Exact DB readback
  confirmed the 21:00 run published eight (six categories), the 22:00 run seven
  (five categories), and the 23:00 run eight: Kosovo 2, Albania 1, Sport 1,
  Technology 1, Economy 1, World 0, Showbiz 2. All remain failed coverage outcomes.
- Read-only Hermes decision retrieval identified the 22:00 editor's three drops:
  an uncorroborated allegation, dependence on another outlet's reporting and a
  mismatched inflation chart plus a wrong bond yield. Those checks are retained.
  Its slowest three-article edit took 548 seconds with zero tool calls.
- Pending implementation splits each desk into two independent one-article
  source pools, at most five concurrent requests, preserving the minute-33 cap.
  Native tests cover disjoint pools, one failed sibling, a whole failed desk,
  zero inventory and actual concurrency. The news suite passes 238 cases.
- Added the Albanian literary adjective and writer terms to culture recognition;
  a real literary-awards headline/excerpt now stays in its registered category.
  Cross-category source restrictions remain unchanged. Editor drops and invalid
  decisions now retain concrete reasons in the worker log.
- Writer/editor instructions discourage irrelevant ceremonial attendee lists
  and role chains; necessary names and official titles must stay accurate. The
  eight-word overlap gate is unchanged. Real isolated model benchmarks and an
  end-to-end QA run are still required before activating this next worker.
- The three difficult editor inputs took 313.6 seconds as independent articles,
  versus 548 seconds in their original shared call. All three were retained;
  one still carried a historical inflation graphic mislabeled as Federal Reserve.
  This is not proof of improved editorial correctness. The default editor chunk
  remains three; one-article editing was only an isolated/QA experiment.
- The confirmed graph filename never says chart/graph. Added time-series asset
  detection before photo selection and to the final Commons provenance gate,
  so a creator/depicts tag cannot make that graphic a photograph. The known
  graphic has zero published DB matches. The news suite passes 240 cases;
  48 photo tests and 18 hourly coverage/capacity tests also pass independently.
- PLD Space photo correction is complete: fresh Luna/max review approved the
  unchanged copy, the conditional photo-only PATCH passed full validation and
  exact readback, and the live page shows the dated, credited Elche HQ photo.
  Copy and publication timestamps are preserved; zero emails were sent.
- Full isolated QA started 23 October at 23:58 Warsaw with fresh discovery,
  no publication/emails and separate state. It stopped at 00:11 on an OAuth
  usage-limit response with no drafts; it does not establish model performance
  or coverage for the pending writer scheduler. Morning production resumed on
  1ce71a07 but still published only 6, 7 and 4 articles at 07:00, 08:00 and 09:00.
- A real one-article-per-category pilot must run only in an idle account window,
  with an explicit pre-hour deadline. Do not activate the pending worker on the
  strength of the quota-blocked end-to-end QA, or claim the coverage goal met.
- To conserve OAuth capacity for production, first target the World/Albania
  requests that stalled or underfilled, rather than running seven extra shadow
  writers. Both calls must meet the unchanged word floor, source/category scope
  and eight-factor schema within their four-minute cap. Full seven-category
  publication remains the acceptance check for the next live worker run.
- Final release checks on 24 October: production build passed; 240 news tests,
  18 hourly coverage/capacity tests and 25 targeted writer/editor checks pass.
  The default editor chunk is still three; no unproven editor setting is enabled.
- df91b7cd was pushed and verified on Railway, then staged as a committed worker
  archive; it was never activated. Final prompt review caught inherited clauses
  saying not to stop at one article and to cover every category. Stopped its idle
  activation waiter before any pilot ran. Follow-up instructions bind each call
  to its cap and its own positive brief allocations, including the one-story cap.
- The idle pilot selects the two least-covered desks in the just-completed run,
  so its small OAuth budget tests the current gaps rather than a stale category
  choice. Publication acceptance still requires two to three in every live desk.
- 445a806c was verified on Railway and activated idle at 10:51:59 Warsaw. The
  first live run is 11:00; actual publication counts are still pending. K/Albania
  pilots returned one scoped article each in 106.4/73.1 seconds, with 151/160 words.
  The pilot checker initially used shorthand score keys; their actual fields
  match the committed schema. A schema-based replay passes all checks, preserves
  the original report and draft hashes, and makes zero additional model calls.
- Pending replacement-writing change addresses the repeatedly timed-out late
  three-article request. The existing planner selects at most three unused
  deficit stories; each gets one request/brief/output, at most three concurrent,
  180 seconds and the same minute-45 deadline. Collector enforces exact source
  and category, one article per job, and private output paths. Approved records
  never enter those model inputs. All normal editorial/publication gates remain.
- Native tests cover independent source pools, missing/invalid siblings, wrong
  source/category, multiple returned articles, bounded real Bash concurrency,
  unchanged approved data, all-request failure and temporary-directory failure.
  The current news suite passes 248 tests; the production build passes. The
  currently active 445a806c worker has NOT been modified with this pending change.

- The 11:00 Warsaw run on 445a806c published four actual database records:
  Kosovë 1, Shqipëri 1, Botë 2, all other desks 0. Exact photo/category and
  live-page readback passed; all-seven coverage failed. This is not completion.
- Recognize a verified restaurant operator as an institution and its explicitly
  named headquarters campus as a company building. Real Darden source research
  recovered three eligible options; final download passed at 1920x1013 with
  source-image comparison and dated archive metadata. No article was approved
  or published by this code-only check.
- Final native news checks: 249 pass; build passes. The separate newsletter
  test cannot import in the QA runtime because cryptography is absent. Its code
  is unchanged. Replacement and restaurant-photo changes await committed release.
- 170b5af2 was verified on Railway (production/main/github-main) and activated
  idle under the publisher lock at 11:56:36 Warsaw. Runtime health confirms max
  reasoning and no fallback model. Its first scheduled run began at 12:00.
- Follow-up photo matching rejects the generic Treasury concept/casino image;
  explicit US Treasury aliases resolve only to the exact US department entity.
  A live metadata check confirmed that identity but uncovered an 1859 construction
  image incorrectly dated by its 2018 upload. The corrected capture-year parser
  rejects it. Preserve the original QA report and its failing date-policy replay;
  no Treasury photo or article was published by these code-only checks.
- Raye's repeated quotation failure was a seven-word song title, not a quoted
  statement. Writer guidance now uses proper work names in running text and
  repair feedback identifies the exact flagged span. This creates no exception
  to quotation, exact-source-overlap or independent review gates.
- Follow-up checks: 261 relevant native news/originality tests pass; production
  build passes. This follow-up is not active in the running 12:00 worker.
- 64077357 is verified on Railway; its worker has not been activated during the
  running 12:00 run. Keep the active 170b5af2 workspace immutable.
- The next initial scheduler requests the full source-ready allocation (up to
  twenty one-story requests), in desk order: all first slots, all seconds, then
  thirds where allocated. Source pools remain disjoint, max concurrency five,
  cap 240 seconds and phase end minute 33. Empty desks launch no calls.
- Native real-Bash checks exercise all twenty requests, round-robin order,
  five-call concurrency ceiling, one failed request, disjoint three-slot pools,
  unavailable third slots, and temporary-directory failure. The relevant suite
  passed 264 tests; the subsequent directory guard and both scheduler tests pass.
  Build passes. These are code checks; the 2–3-per-desk live acceptance remains unmet.
- Read-only Commons metadata audit: 216 published records, 174 unique files,
  zero pre-1900 capture dates and zero unresolved metadata results. Neither
  the Treasury casino nor 1859 construction file occurs in the 250 newest rows.
- User reaffirmed on October 24: publisher names stay banned everywhere in public
  news copy and displays. Keep interview-dependent stories excluded when truthful
  reporting would require naming the outlet. This clarification is resolved.
- 63d7bb67 activated at 13:09 Warsaw, idle under the publisher lock. The 13:00
  run had already stopped for model quota; 14:00 also stopped for quota. The
  15:00 run published 11, with exact database/photo readback: Kosovë 2, Shqipëri 2,
  Sport 1, Teknologji 2, Ekonomi 0, Botë 3, Showbiz 1. Coverage remains incomplete.
  The 12:00 run failed during independent review and did not publish its drafts.
- A writer truncated a long Top Channel URL by dropping `-ne-oborr`, disconnecting
  a prepared Albania photo. Drafts now carry a short prepared source ID. The
  writer-only wrapper restores a missing/cut-off URL from that exact scoped ID,
  rejects unknown/conflicting IDs or categories, removes the temporary ID, and
  leaves all prose and subsequent source/photo/review gates unchanged.
- Replaced the hourly first-three-words location rule with natural location
  inclusion anywhere in local headlines. Reject leading location labels followed
  by a colon or dash. The verified city field and legacy daily behavior remain.
- Identity/category-conflict and headline regressions included: 281 native
  news/originality/topic checks pass; build passes. Pending worker activation
  requires the committed release, live SHA, idle publisher lock and source-ID pilot.
- 8ffcf05e merges the user's newer homepage commits without changing their intent.
  Railway reports that exact SHA in production/main/github-main. Its committed
  worker activated idle under lock at 16:55:42 Warsaw, for the 17:00 run.
  The isolated model pilot timed out at 180 seconds, with no draft or approval;
  record `/opt/data/qa/383/source-id-pilot-8ffcf05e/timeout-180.json` preserves this.
  Deployment proceeded on 281 checks, build and backward-compatible exact-URL
  handling. Live 17:00 writer responses subsequently returned valid source IDs
  in six desks; this is real protocol evidence, not article-quality approval.
- The 16:00 run on 63d7bb67 published 9: Kosovë 3, Shqipëri 0, Sport 0,
  Teknologji 0, Ekonomi 2, Botë 3, Showbiz 1. It remains below acceptance.
- Pending collection expansion registers 14 publishers, across all seven desks:
  96 publishers total, 78 feeds, 10 public listings. MIT News shares the existing
  MIT Technology Review family; CBS News/Sports share a family. No category leakage.
  Public access probes excluded inaccessible/restricted alternatives rather than
  treating a working RSS preview as a readable original article.
- Fixed visible body selection for BleepingComputer (37 -> 640 actual words)
  and A2 CNN. Hidden/restricted content remains excluded. Shqiptarja's naive
  local timestamps use declared Europe/Tirane with a DST regression check.
  Explicit publisher gaming labels are excluded before costly preparation;
  this applies the existing ban and does not scan passing body mentions.
- Real new-source-only discovery found 155 raw candidates: Kosovë 8, Shqipëri 29,
  Sport 36, Teknologji 42, Ekonomi 12, Botë 13, Showbiz 15. These are neither
  deduplicated nor photo/editorially approved. Proof is in QA expanded-only discovery.
- Replacement capacity increases to five scoped one-story calls, the proven
  initial concurrency ceiling, at the same 180-second/minute-45 limits. Native
  tests reproduce five missing floor places and preserve approved copy unchanged.
- Expanded checks: 306 pass, production build passes. Updated source inventory
  describes the repository registry; worker activation is still required.
- Pending user photo choice: whether clearly captioned physical asset-symbol
  photographs (Bitcoin display tokens/euro notes) may illustrate that asset's
  market news. Do not change photo eligibility while this answer is pending.

## 24 October: approved asset photographs
- User approved clearly labelled photographs of the exact market asset. Implemented a finite, visually reviewed Commons inventory: two Bitcoin, three Ethereum, two euro photos. Chart-background candidates and a hardware-wallet-dominated photo were excluded.
- Original SHA1, current creator/licence and actual capture date must match. Known-date, stable asset illustrations use the ten-year archive ceiling, with immutable dated Albanian illustrative captions. Only exact-asset Ekonomi market headlines qualify; company stock stories, forks, software/security stories, unrelated amounts and ambiguous tickers fail closed.
- Normal source fingerprints, decoded 1200x630 minimum, model photo fit, within-batch uniqueness and trusted provenance remain required. Final validation checks that the writer has kept the same market asset.
- QA: 281 news/originality/topic checks plus 37 hourly/source-reader checks passed; production build passed. Seven real Commons files fetched, decoded and revalidated successfully in isolated QA (asset-photo-real-proof-20261024.json). Asset-specific checks rerun after headline exclusions. No QA articles or approval receipts were published.
- Expanded-source d80 worker activated 17:49 Warsaw; 18:00 run produced 18 initial drafts across all desks. Final editorial/review/publication counts remain pending. The 2-3 per category goal is not complete.
