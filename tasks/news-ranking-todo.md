# News ranking and notification tasks
- [x] Diagnose live email sender and suppress five-minute emails through existing notification-only dry-run guard.
- [x] Persist a notification policy that permits only hourly launch/completion emails, with tests.
- [x] Remove forced neutral ranking and supply evidence-based per-story rubric to writer/editor; verify weighted scores.
- [x] Share 0.2/hour rank and fresh selection across homepage sections, with regression tests.
- [x] Review complete diff and run tests/build.
- [x] Release website through Railway GitHub integration and verify rendered fresh sections.
- [x] Install committed worker after active slot; re-score recent neutral rows using evidence.
- [x] Verify real hourly score variation, freshness and notification behavior before completion.

Review checkpoint: inspected the full change directly using review-agent and code-review-and-quality. Fixed a missing mostRead binding caught by the build and updated the legacy mail fallback test to an allowed completion phase. No remaining actionable findings. Tests: 22 frontend selectors, 3 ranking, 14 source policy, 12 coverage, 7 publication, notification template and legacy support checks passed; production build passed.

Live validation on 2026-10-08:
- Railway GitHub production and worker code matched fa1f568d before this documentation release; normalized source hashes matched committed files.
- Re-scored 125 neutral-score stories with Luna max from retained evidence, exact identity/factor validation and metadata-only database readback. Scores span 2.8–8.2; genuinely equal ratings remain allowed.
- Corrected 136 recent site-publication clocks from recorded batch insert times, preserving source timestamps in raw_article.source_published_at and verifying all other fields unchanged. New hourly publication stamps the actual insert time; retries retain the existing clock.
- The 19:00 UTC / 21:00 CEST scheduled run published and live-verified 18 articles, with independently reviewed scores 3.2–6.9 matching all eight weighted factors. Target remains 20; the final replacement pass exhausted usable candidates. Shqipëri candidates failed corroboration and that desk published zero in this slot. No claim of guaranteed 20 or seven-desk coverage in every slot.
- Exactly two Gmail successes in that run: startup 19:00:04 UTC, publication report 19:40:36 UTC. Re-scoring sent no emails; repeated health checks logged ALERT_DRY_RUN without SMTP.
- Live Top 5 had five distinct recent stories in the exact expected decayed order, including Economy and Technology; Njoftimet had 12 unique stories within 24 hours. Five category-page lead checks were also fresh. Timer remains active daily 07:00–23:00 Europe/Warsaw, using gpt-6-luna with max reasoning through OAuth.
