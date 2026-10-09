# Telegram publishing and channel card

- [x] Inspect screenshot, production bot identities/permissions, schedule logs and existing code.
- [x] Obtain approval for separate plan files.
- [x] Restore dispatcher token selection and observable send failures.
- [ ] Verify actual published article/link, ledger entry and repeat idempotency.
- [ ] Verify automatic schedule execution with working dispatcher.
- [x] Implement and test latest public Telegram message API.
- [x] Refresh card from latest message; use 383 logo and channel wording.
- [x] Verify UI refresh, desktop rendering and mobile overflow.
- [x] Complete focused tests and production build.
- [x] Complete read-only code-review-and-quality and review-agent review; resolve actionable findings.
- [ ] Commit/push clean release and verify deployed SHA.
- [ ] Verify live automatic posting and newest-message preview parity.

## Implementation evidence
- 22 focused Telegram tests pass, including real-route token selection, successful link posting, repeat idempotency, failure HTTP status and no extra send on an ambiguous timeout.
- Actual public channel page parses to message 60 and the matching article URL/timestamp.
- Browser verifies exact latest text/link, 383 logo, channel wording, one-minute refresh without reloading, and no mobile horizontal overflow.
- Read-only review covered the complete diff and tests. A new timeout fallback defect was fixed and regression-tested; subsequent review found no actionable defects.
- Runtime/release checks below are completed after the GitHub-driven deployment; the final evidence file is stored in the external news-layout-evidence directory.
