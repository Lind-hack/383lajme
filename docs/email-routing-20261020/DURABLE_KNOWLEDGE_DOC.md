# Durable Knowledge — Email routing and animated identity
Status: RESOLVED · Started: 2026-10-20 · Updated: 2026-10-20

## Context
Operator mail to lindsylqa@gmail.com must use the existing Gmail SMTP account and consume no Resend quota. Confirmation, recovery and Tregu league emails need the animated 383 logo.

## Decision Records
### D1 — Keep operator reports, change transport
- Question: What should happen to monitoring and checkup mail?
- Decision: Keep delivery to the operator through Gmail SMTP, with no Resend fallback.
- Rationale: User requested delivery from their SMTP account to avoid exhausting Resend quota.
- Source: user objective.
- Confidence: high.
### D2 — Both logo placements
- Question: Animated 383 logo inside emails, sender avatar in Gmail, or both?
- Decision: Both.
- Rationale: User explicitly selected both.
- Source: user answer, 2026-10-20.
- Confidence: high.
- Follow-ups: locate the intended GIF and inspect sender-account profile access.

## Resolved Constraints
- Do not disable monitoring itself or delete API credentials used by reader emails.
- Railway blocks direct Gmail SMTP; operator messages originating there need the existing private SMTP worker or an equivalent authenticated route.
- A sender avatar is controlled by the sender's Google account and recipient clients; HTML cannot set it.

## Open Questions
None.

## Key Facts Discovered
- scripts/codex_automation_support.py previously preferred Resend; operator reports now use Gmail SMTP only, including failure paths.
- scripts/clarity_daily_report.py now uses Gmail SMTP only.
- lib/mailer.ts queues explicitly marked operator reports for private Gmail SMTP; reader mail retains its branded Resend sender. Direct Gmail SMTP is unavailable on Railway.
- Current auth templates are emails/confirm-signup.html and emails/recovery.html.

## Synthesis
Operator routing and in-email animated branding are deployed and verified. User explicitly chose the animated logo inside emails only (D5), so no sender-avatar or Google-account setup remains. Operator reports never fall back to Resend; reader confirmation, recovery and league mail retain their 383 sender addresses.

### D3 — Preserve the branded sender
- Question: Does noreply@383ks.com have a Google account, or should all mail use personal Gmail?
- Decision: Keep the 383 sender; no Google account exists for it.
- Rationale: User wants personal Gmail only for operator reports and the branded address for readers.
- Source: user answer, 2026-10-20.
- Confidence: high.
- Follow-ups: sender-avatar setup requires an account associated with the branded address; preserve personal Gmail profile.
### D4 — Existing logo asset
- Decision: Use Downloads/383-logo-animated-v2-256.gif, the latest compact existing version, unchanged.
- Source: local files, last modified 2026-10-01.
- Confidence: high.

## Release verification — 2026-10-20 21:42 UTC
- Production commit: cb8ed082b873055172a9c933eb606cd89eb452d2; Railway GitHub deployment 0306bba8-adbc-4c9e-808c-cc8a516a761c SUCCESS. /api/deployment-info reports the same SHA, main, production, github-main.
- Public GIF: https://383ks.com/email/383-logo-animated.gif — HTTP 200, image/gif, 46,273 bytes; original asset 256×256 with 47 frames.
- Auth confirmation and recovery templates installed in the running Studio bind mounts, existing Supabase SMTP remains smtp.resend.com/noreply@383ks.com.
- League reader mail remains branded from tregu@383ks.com, including messages sent to Lind's own reader account. Explicit purpose=operator selects the Gmail queue only for operator reports.
- Newsletter remains on the existing Gmail sender; no reader preferences, schedules, or subscriptions were changed.
- Live newsroom operator env no longer contains RESEND_API_KEY. Existing Gmail user is lindsylqa@gmail.com; EMAIL_PRIMARY=gmail. Clarity and video fallback paths patched in the active worktree; legacy failure alerts remain suppressed as before.
- Encrypted operator queue migration applied. SQL transaction verified anon/authenticated cannot access the queue or RPCs, duplicate IDs deduplicate, claims and receipts work. Test rows rolled back.
- 383-operator-mail.timer enabled and active; service successful. Worker tests passed on the actual Linux host (local Python cryptography has a pre-existing missing _cffi_backend).
- Verification queue job be772f43c89b5366dfb17ec00e19849f00abe94266abfba62db1f3cb8e8f171f marked sent at 2026-10-20T21:41:30.293232Z.
- Gmail independently shows verification thread 1a15b43268de9aad from and to lindsylqa@gmail.com, INBOX and SENT, subject “383 SMTP routing verification — 2026-10-20”. Exactly one test sent; rerunning the verifier reuses its deterministic queue ID.
- Independent read-only review found two issues, both fixed: explicit operator purpose prevents rerouting reader mail; accepted SMTP DATA cannot be retried due to a failed QUIT. Reviewer rechecked and returned no remaining findings.
- Final build, operator routing/branding tests, startup/report/Clarity tests and diff checks passed.
- Browser tool unavailable this turn (“failed to write kernel assets” after reset too); no Google profile changes attempted.

### D5 — In-email animated logo only (supersedes D2 avatar requirement)
- Question: Will you set up Google profiles for the exact sender addresses, or should we use the animated logo inside emails only?
- Decision: Use animated logo inside emails only. No sender-avatar setup or account creation requested.
- Rationale: User explicitly selected the in-email-only option after learning the separate sender-profile requirements.
- Source: user answer, 2026-10-20.
- Confidence: high.
- Follow-ups: none. D2's in-email logo requirement remains satisfied; its sender-avatar requirement is superseded.
