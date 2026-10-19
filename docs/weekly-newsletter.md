# Weekly newsletter

Readers subscribe directly in the illustrated homepage card (`/#newsletter`) or
the compact card beneath Tregu in the hamburger menu. The footer links to the
homepage card. Ordinary `/newsletter` visits redirect there; that route is reserved
for confirmation and unsubscribe utility screens. No account is required.
Consent is separate from login and interests. Enter an email and click Abonohu:
activation is immediate, with no confirmation email, code or welcome-message dependency.
The disclosure under the button records deliberate weekly-email consent. A service-role
RPC atomically records activation and limits each hashed IP to five requests per hour;
throttled requests return HTTP 429 rather than a false success. Already-active readers
keep their original audience cutoff; rejoining readers get a fresh activation timestamp.
`confirmed_at` remains the internal activation timestamp and does not assert verified inbox ownership.
Old pending readers are not activated in bulk. Previously issued confirmation links
remain compatible. GET links cannot unsubscribe readers; the utility page requires POST.

## Content and schedule

Sunday at **10:00 Europe/Tirane (Kosovo)**. Each issue covers the previous Sunday
10:00 through this Sunday 10:00, accounting for DST. It ranks the entire persisted
`news_articles` archive for that interval by editorial featured status, engagement score and recency, deduplicates slugs and
normalised titles, and gives different categories space in the lead selection.
Up to eight stories are grouped under clear category headings in both HTML and plain text. Each
represented category receives a slot before remaining slots are filled. Every selected
story has its own valid HTTPS article photo, a short published summary, source and
full-story link. Candidates missing a real image or reporting text are skipped rather
than illustrated with unrelated photos. Captions and creator/license attribution travel
with the frozen image. Missing excerpts use the published body. Summaries end at a
sentence or word boundary, at most 280 characters. The ending marks completion without
promotional detours. Headlines and summaries remain readable with images blocked. There is
no generated reporting, mock fallback, or dependency on an LLM. An empty archive
skips sending rather than inventing a recap. Content is frozen in `newsletter_issues`
before delivery, so later retries use the same edition.

The primary server calendar timer starts Sunday at 10:00 Europe/Tirane and retries
every 15 minutes through Monday 05:45 local time. The existing GitHub schedule is a
backup: both call the same idempotent endpoint, so overlap cannot duplicate a delivery. The endpoint enforces
the local cutoff and stops after 20 hours. Up to five recipients per request;
workflow runs process up to 12 requests and resume on the next scheduled run.
This bounds serverless execution time. Larger lists may need a dedicated queue
worker before they outgrow this delivery window.

## Activation

1. Apply migrations `0111_weekly_newsletter.sql`, `0112_newsletter_mail_queue.sql`
   and `0113_newsletter_single_click.sql` to the intended database
   using the normal migration process. First run the rollback-only integration test
   `supabase/tests/weekly_newsletter.sql` in an isolated database with no subscribers.
2. Set the server environment values below. Use the existing Supabase URL and
   service-role key. No new npm dependencies are needed.
3. Use the repository's required clean GitHub release flow in `AGENTS.md`.
   This feature does not deploy anything itself.
4. Set GitHub Actions secret `CRON_SECRET` to match the server, and repository
   variable `NEWSLETTER_SITE_URL` to the intended production origin. Configure the
   same origin on the server for email links. The workflow defaults to the Railway production
   domain required by the current repository release policy.
5. Verify the sender domain in Resend (SPF/DKIM), configure the sender address, and
   **disable open and click tracking** for the sending domain. Send to an internal
   test subscriber before enabling delivery to readers. No real emails are sent by
   the automated local tests.

```dotenv
RESEND_API_KEY=...
NEWSLETTER_FROM=383 <newsletter@your-verified-domain>
NEWSLETTER_SECRET=... # stable, random secret of at least 32 characters
NEWSLETTER_SITE_URL=https://383ks.com
```

Keep the signing secret stable: rotating it invalidates old unsubscribe links.
Keep sender/origin/signing settings stable while an issue is being delivered.
Resend is already used by repository reporting scripts; this feature uses its
HTTPS email API with timeouts and explicit HTML/plain-text alternatives.

## Delivery safety and operations

The database is private to `service_role`; public and logged-in clients cannot
read the subscriber list or call its RPCs. Only hashes of confirmation tokens
are stored. Each IP hash permits five requests per hour; each unconfirmed address
can receive at most one request per ten minutes. IP buckets expire after two hours,
and unconfirmed subscribers after seven days, cleaned on requests and weekly runs.
Unsubscribed records are retained to preserve opt-out history and can be deleted
on a reader's request. Delivery rows contain no recipient email copies.

Delivery uses a unique `(issue_id, subscriber_id)` key and a two-minute claim lease.
Every send uses a stable Resend idempotency key. After a timeout or failed database
receipt write, the next run can retry the same immutable message. Retries stop
after eight attempts or 20 hours, safely inside Resend's 24-hour idempotency
retention. Permanent provider failures are held for investigation. This provides
duplicate protection within that retry window, not an exactly-once SMTP guarantee.

Unsubscribe is signed, works without login, cancels pending deliveries, and is
checked again immediately before each send. An email already handed to the provider
cannot be recalled. Both visible unsubscribe links and RFC 8058 one-click POST
headers are supplied. There are no recipient lists in API responses or logs.
Newsletter management pages are excluded from the site's analytics loader so
confirmation and opt-out tokens are not reported as page URLs on those pages.

Inspect `newsletter_deliveries` for `held`, `last_error`, `attempts`, `provider_id`
and `sent_at`. Workflow failures flag provider/configuration/held-delivery issues.
Never blindly reset held deliveries after the provider's idempotency window;
check provider receipts first. The worker will not send old issues midweek.

```sh
node --test lib/newsletter.test.mjs lib/newsletter-server.test.mjs
npm run build
```

Release verification on 18 October 2026: the clean release based on current main
passed all 1,366 repository tests and `npm run build`. The migration and rollback-only
SQL tests passed in an isolated PostgreSQL-compatible PGlite database, including
retry expiry, claim leases, consent and role permissions. HTTP validation covers
origin, invalid input/tokens, consent, body limits and automation authentication.
Desktop/mobile signup rendering and native email validation were browser-checked.
The initial release used mocked provider responses. The follow-up below includes real inbox verification.

Production uses Railway's GitHub integration for `383ks.com`, as confirmed by the
product owner. Newsletter sender settings were configured with `--skip-deploys`,
and migration 0111 was applied to the production database before the code release.
The homepage card uses reduced vertical padding and a smaller mobile illustration;
the compact menu card retains its reviewed dimensions.
The release also updates Next.js to 16.3.8, Nodemailer to 10.1.6 and affected
transitive packages; npm audit reports zero vulnerabilities.

Provider references: [Resend idempotency](https://resend.com/changelog/idempotency-keys),
[email headers](https://www.resend.com/changelog/custom-email-headers).

## Quota fallback and verification (18 October 2026)

The live Resend API returned `429 daily_quota_exceeded`. The product owner approved
the existing Gmail sender as a temporary fallback. Only that explicit rejection
uses Gmail: timeouts and other uncertain Resend sends retain their idempotent retry.
The fallback uses `GMAIL_USER` / `GMAIL_APP_PASSWORD`, identifies itself as 383,
and replies to `NEWSLETTER_FROM`. Its authenticated Gmail address is visible.
A definite confirmation rejection releases only the matching token/cooldown so a
reader can retry; it never clears a newer request.

Weekly SMTP delivery persists `held / smtp_inflight` before contacting Gmail.
Successful delivery records the receipt as `sent`. A crash, uncertain SMTP response,
or failed receipt stays held for operator inspection instead of sending a duplicate.
A definite rejection remains retryable or held according to the error.
Do not reset an SMTP hold without checking sent mail/provider receipts first.

The workflow was dispatched successfully against production (run 39149833273).
A real redesigned weekly preview reached the authorized test inbox through Gmail.
`node scripts/preview-newsletter.mjs` reads an allowlisted configuration JSON from
stdin and writes HTML to its `output` path. It sends only when `recipient` and
`testId` are explicitly supplied; keep its output outside tracked/public files.
The website card is approximately 199px high on desktop and 321px at 390px wide.
It uses an unfiltered SVG illustration and a native checkbox behind an animated
consent capsule, with keyboard focus and reduced-motion handling.

## Hosted delivery correction

The live Railway signup test could not deliver over SMTP, although the local
Gmail preview reached the inbox. The fallback therefore runs on the existing
private server instead of attempting SMTP from Railway. No public relay is exposed.

Apply migration `0112_newsletter_mail_queue.sql`, upload the worker, install its
private settings at `/etc/383-newsletter.json`, and run
`scripts/install-newsletter-mail-worker.sh` as root. Settings contain the local
Supabase API URL, service role, newsletter signing secret, sender and existing
Gmail credentials. The settings file is root-owned, readable only by the dedicated
newsletter service group; the systemd service has a read-only filesystem.
Only then enable `NEWSLETTER_SMTP_QUEUE=1` in the application.

After a definite Resend quota rejection, the application atomically queues the
message. Tokens and email contents use AES-256-GCM, bound to the job identity.
Only the private worker can read/decrypt them. It checks consent again, claims
each job once, sends via Gmail and persists its receipt. Every 15 seconds it
checks for more work. Known temporary rejections back off five minutes; uncertain
SMTP acceptance or a crash stays held, never automatically duplicated. Weekly
queued messages are counted separately from successful sends. Ciphertexts are
cleared seven days after job expiry. Subscriber deletion cascades to queued mail.

Inspect with `systemctl status 383-newsletter-mail.timer` and
`journalctl -u 383-newsletter-mail.service`; logs contain counts, not recipients.
Run `supabase/tests/newsletter_mail_queue.sql` in an isolated database (or an empty
newly installed queue); its fixtures roll back. Python worker tests cover consent
revocation, explicit rejections, uncertain acceptance and receipt loss.


## Single-click release verification

`supabase/tests/newsletter_single_click.sql` checks immediate activation, repeat signup,
fresh rejoin, stale confirmation cancellation, weekly queue cutoff cancellation,
rate limiting, pending-reader isolation and service-role permissions. Run it in the
isolated newsletter database alongside the legacy and queue tests. New signup requires
only database access and `NEWSLETTER_SECRET`; provider credentials are needed for weekly delivery.
The worker rechecks the issue cutoff immediately before SMTP, in addition to its database claim.

New weekly snapshots contain photos and credits. Existing frozen editions remain unchanged,
including already queued payloads; never rewrite a sent issue to retrofit its design.
Email HTML has a plain-text alternative and is kept below 80 KB in release verification.


## Verified audit — 19 October 2026

The audit found scheduled GitHub runs but no weekly delivery receipts: the only reader
joined after 18 October's cutoff. That reader's first eligible edition is 25 October,
18:00 Kosovo / 17:00 UTC. Do not describe zero-recipient workflow success as inbox delivery.

`383-weekly-newsletter.timer` is installed on the existing private server. Its
`Europe/Tirane` calendar handles DST; the 25 October transition was checked using
`systemd-analyze calendar`. `Persistent=true` catches a missed wakeup; the endpoint's
20-hour gate prevents late midweek mail. GitHub remains backup. Manual execution
reached production and returned `outside_weekly_window` on Monday evening.

Install `run_weekly_newsletter.py` under `/opt/383-newsletter`, put `SITE_URL` and the
existing automation credential (`CRON_SECRET`) in `/etc/383-newsletter-schedule.json`
(root:newsletter,0640), then run `scripts/install-weekly-newsletter-timer.sh` as root.
The request uses an explicit scheduler User-Agent; the server's default Python agent
was rejected with HTTP403. Redirects are refused so the authorization header cannot
be forwarded to another host. Logs contain counts and HTTP status, not credentials.

`NEWSLETTER_MAIL_PROVIDER=gmail` uses the previously approved Gmail sender as the
primary private queue transport, with `NEWSLETTER_SMTP_QUEUE=1`. It contacts no Resend
API. `resend` remains the default when the variable is absent, with the existing
quota-only Gmail fallback. Never switch an uncertain in-flight send to another provider.
Queued is not sent: the worker writes the receipt only after SMTP acceptance.

A new categorized preview was received in the approved Gmail inbox on 19 October
(message `1a155d1fbdeb0b4f`), using the installed worker's actual SMTP transport.
Inspection verified seven category headings, eight images from website article records,
summaries, photo credits, plain-text categories and unsubscribe. Desktop and 390px preview
had no horizontal overflow and all eight photos loaded. The preview is not a scheduled
weekly-delivery receipt; recurring delivery still depends on server/provider availability.

A further controlled test exercised the real production database claim, encrypted
queue, worker and weekly receipt. The message reached Gmail (message
`1a155de63b069a6c`), and the synthetic issue/queue/delivery fixtures were removed.
Subscriber consent and activation time were unchanged. This verifies the delivery
pipeline while preserving the distinction between a test and an actual Sunday issue.

The selection is an editorial heuristic, not a claim that every important world event
is included: it uses featured status, popularity, category diversity and the published
weekly archive. Unpublished events and articles without usable photos/text cannot appear.

## Schedule update — 19 October 2026

The reader-requested schedule is now Sunday at **10:00 Europe/Tirane (Kosovo)**
for every active subscriber. This supersedes the earlier 18:00 timing in dated audit
notes. The next dispatch is 25 October 2026 at 10:00 Kosovo / 09:00 UTC.
The primary timer and GitHub backup retain the 20-hour retry window and delivery
idempotency; existing subscriber consent and historical issue snapshots are unchanged.
