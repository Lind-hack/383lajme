# Durable Knowledge — Email routing and animated identity
Status: IN PROGRESS · Started: 2026-10-20

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
- Locate the existing animated 383 GIF.
- Inventory active operator senders and validate transport changes.
- Inspect actual sender account used for auth and league mail before changing its public profile.

## Key Facts Discovered
- scripts/codex_automation_support.py prefers Resend unless EMAIL_PRIMARY selects Gmail.
- scripts/clarity_daily_report.py directly attempts Resend first.
- lib/mailer.ts uses Resend for all website mail; direct SMTP previously timed out on Railway.
- Current auth templates are emails/confirm-signup.html and emails/recovery.html.

## Synthesis
Pending inventory and sender-profile decision details.

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
