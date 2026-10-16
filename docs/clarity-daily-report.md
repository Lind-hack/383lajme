# Daily website usage email

Recipient: lindsylqa@gmail.com. Requested schedule: 09:00 Europe/Warsaw.
GitHub Actions schedules the job in that timezone, including daylight saving.
Delivery can be later than 09:00 if GitHub queues the scheduled run.

`.github/workflows/clarity-daily-report.yml` fetches two Clarity exports for the
rolling previous 24 hours: overview and URL breakdown. It uses the repository's
Resend email sender, with Gmail SMTP fallback. It also reads the protected
`/api/analytics/usage` summary with `CRON_SECRET`. A report run never deploys
the website; the summary purges anonymous counter events older than seven days.

Required secrets: `CLARITY_EXPORT_TOKEN` and `CRON_SECRET`. The existing `RESEND_API_KEY`,
`EMAIL_FROM`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` provide email delivery.

Manual test: `gh workflow run clarity-daily-report.yml --ref main`.
Inspect field names without sending: add `-f inspect=true`.
Each execution uses two of Clarity's ten daily API requests; avoid repeated runs.

The email uses email-safe tables and inline colors, with a numeric feature
heatmap, button rankings, clicked destination pages, page interaction, and total
active-time rankings. Clarity provides contextual page visits, average engagement,
and frustration counts. Clicks are never inferred from page visits. Each heatmap
column has an independent relative scale. The email links to actual on-page
Clarity heatmaps for spatial click positions. See `docs/usage-email.design.md`.

Counter collection is opt-in through the existing statistics consent, uses
random browser/session IDs hashed on the server, never records form content or
raw IP addresses, and normalizes private invite/paper paths. No account IDs or
arbitrary button text are sent. Named controls use a closed action vocabulary;
unrecognized controls appear as “Other”. Time counts only foreground activity
with a 60-second idle cutoff; sessions rotate after 30 minutes of inactivity.
New counters report the earliest retained measurement and do not backfill clicks.
Per-feature retention and usefulness scores are not claimed.

Migration: `supabase/migrations/0110_site_usage.sql`. SQL regression check:
`psql -v ON_ERROR_STOP=1 -f supabase/tests/site_usage.sql` (fixtures roll back).
The measurement table and RPCs deny public/authenticated access; only the
service-role API can write/read them. Batches deduplicate event UUIDs and have
size/rate/time bounds. Public summary access requires the cron bearer secret.

Only consenting visitors appear. Missing values and empty windows are explicit.
Raw exports, identifiers, and report contents never enter Actions logs/artifacts.
Preview with `python scripts/preview_usage_email.py`; it labels all example data
as illustrative and is never used for production email.
