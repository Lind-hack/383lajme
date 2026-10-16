# Daily website usage email

Recipient: lindsylqa@gmail.com. Requested schedule: 09:00 Europe/Warsaw.
GitHub Actions schedules the job in that timezone, including daylight saving.
Delivery can be later than 09:00 if GitHub queues the scheduled run.

`.github/workflows/clarity-daily-report.yml` fetches two Clarity exports for the
rolling previous 24 hours: overview and URL breakdown. It uses the repository's
Resend email sender, with Gmail SMTP fallback. No website deployment or data
mutation occurs during a report run.

Required secret: `CLARITY_EXPORT_TOKEN`. The existing `RESEND_API_KEY`,
`EMAIL_FROM`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` provide email delivery.

Manual test: `gh workflow run clarity-daily-report.yml --ref main`.
Inspect field names without sending: add `-f inspect=true`.
Each execution uses two of Clarity's ten daily API requests; avoid repeated runs.

Reports rank sections by page sessions, not unique feature users. They show
available engagement and frustration metrics. Exact button-click rankings,
per-feature retention, historical comparisons, and usefulness scores are not
provided by this export and must not be inferred. Only consenting visitors appear.
Missing fields are explicitly reported as unavailable. URLs omit query strings;
account/admin/API pages and external domains are excluded from rankings. Neither
raw exports nor report contents are written to Actions logs or artifacts.
