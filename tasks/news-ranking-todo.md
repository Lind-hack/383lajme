# News ranking and notification tasks
- [x] Diagnose live email sender and suppress five-minute emails through existing notification-only dry-run guard.
- [x] Persist a notification policy that permits only hourly launch/completion emails, with tests.
- [x] Remove forced neutral ranking and supply evidence-based per-story rubric to writer/editor; verify weighted scores.
- [x] Share 0.2/hour rank and fresh selection across homepage sections, with regression tests.
- [x] Review complete diff and run tests/build.
- [ ] Release website through Railway GitHub integration and verify rendered fresh sections.
- [ ] Install committed worker after active slot; re-score recent neutral rows using evidence.
- [ ] Verify real hourly score variation, freshness and notification behavior before completion.

Review checkpoint: inspected the full change directly using review-agent and code-review-and-quality. Fixed a missing mostRead binding caught by the build and updated the legacy mail fallback test to an allowed completion phase. No remaining actionable findings. Tests: 22 frontend selectors, 3 ranking, 14 source policy, 12 coverage, 7 publication, notification template and legacy support checks passed; production build passed.
