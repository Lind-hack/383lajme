# Weekly newsletter

Readers subscribe directly in the illustrated homepage card (`/#newsletter`) or
the compact card beneath Tregu in the hamburger menu. The footer links to the
homepage card. Ordinary `/newsletter` visits redirect there; that route is reserved
for confirmation and unsubscribe utility screens. No account is required.
Consent is separate from login and interests. A confirmation email opens
a page with a button; only its POST activates the subscription. Link scanners cannot
subscribe or unsubscribe readers by fetching a GET URL. Confirmation expires in 24
hours. Repeat requests return the same public response without exposing membership.

## Content and schedule

Sunday at **18:00 Europe/Tirane (Kosovo)**. Each issue covers the previous Sunday
18:00 through this Sunday 18:00, accounting for DST. It ranks the entire persisted
`news_articles` archive for that interval by engagement score, deduplicates slugs and
normalised titles, and gives different categories space in the lead selection.
Up to eight main stories and four extra headlines include published excerpts,
source labels and article links. Tregu and Visit links finish the email. There is
no generated reporting, mock fallback, or dependency on an LLM. An empty archive
skips sending rather than inventing a recap. Content is frozen in `newsletter_issues`
before delivery, so later retries use the same edition.

The GitHub workflow checks every 15 minutes during Sunday evening/Monday retry
hours; GitHub can delay cron, so delivery is approximate. The endpoint enforces
the local cutoff and stops after 20 hours. Up to five recipients per request;
workflow runs process up to 12 requests and resume on the next scheduled run.
This bounds serverless execution time. Larger lists may need a dedicated queue
worker before they outgrow this delivery window.

## Activation

1. Apply `supabase/migrations/0111_weekly_newsletter.sql` to the intended database
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
Provider tests use mocked responses; no real test emails were sent.

Production uses Railway's GitHub integration for `383ks.com`, as confirmed by the
product owner. Newsletter sender settings were configured with `--skip-deploys`,
and migration 0111 was applied to the production database before the code release.
The homepage card uses reduced vertical padding and a smaller mobile illustration;
the compact menu card retains its reviewed dimensions.
The release also updates Next.js to 16.3.8, Nodemailer to 10.1.6 and affected
transitive packages; npm audit reports zero vulnerabilities.

Provider references: [Resend idempotency](https://resend.com/changelog/idempotency-keys),
[email headers](https://www.resend.com/changelog/custom-email-headers).
