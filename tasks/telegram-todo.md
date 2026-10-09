# Telegram publishing and channel card

- [x] Inspect screenshot, production bot identities/permissions, schedule logs and existing code.
- [x] Obtain approval for separate plan files.
- [x] Restore dispatcher token selection and observable send failures.
- [x] Verify actual published article messages, ledger entry and repeat idempotency. Three posts (61–63); repeat posted zero. Link-resolution follow-up below.
- [x] Verify enabled automatic schedule and successful execution of its workflow. GitHub's */15 schedule remains active; full workflow manually exercised on the restored production dispatcher.
- [x] Implement and test latest public Telegram message API.
- [x] Refresh card from latest message; use 383 logo and channel wording.
- [x] Verify UI refresh, desktop rendering and mobile overflow.
- [x] Complete focused tests and production build.
- [x] Complete read-only code-review-and-quality and review-agent review; resolve actionable findings.
- [x] Commit/push clean release and verify deployed SHA (2f528555).
- [x] Verify live publishing workflow and newest-message preview parity (message 63).
- [x] Implement and test the short-link proxy fix; full follow-up build and read-only review passed.

Final release gate: verify the deployed follow-up SHA and all three posted links resolving to public articles. The completion audit for this gate is recorded in `telegram-release-verification.txt` in the external news-layout-evidence directory after deployment.

## Implementation evidence
- 22 focused Telegram tests pass, including real-route token selection, successful link posting, repeat idempotency, failure HTTP status and no extra send on an ambiguous timeout.
- Actual public channel page parses to message 60 and the matching article URL/timestamp.
- Browser verifies exact latest text/link, 383 logo, channel wording, one-minute refresh without reloading, and no mobile horizontal overflow.
- Read-only review covered the complete diff and tests. A new timeout fallback defect was fixed and regression-tested; subsequent review found no actionable defects.
- Runtime/release checks below are completed after the GitHub-driven deployment; the final evidence file is stored in the external news-layout-evidence directory.
- Live workflow 37992863949: configured true, checked 3, posted 3, failed []; repeat 37992964682: checked 0, posted 0, failed []. Public messages and ledger entries agree. Live card matches message 63 exactly; both join links, logo, timestamp and responsive overflow verified.
- Live article-link verification exposed an internal-origin redirect. The resolver now uses SHORT_BASE, shared with the short-link generator. Proxy-route regression tests and all 29 focused tests pass; full follow-up build and review passed. Live follow-up release acceptance is required by the final gate above.
