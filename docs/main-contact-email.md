# Main contact address — 2026-10-21

Status: verified and configured; release through GitHub integration.

## User decision

Use `info@383ks.com` as the public contact address and weekly newsletter sender.
Keep authentication on `noreply@383ks.com`, league mail on `tregu@383ks.com`,
and operator reports on private Gmail SMTP with no Resend fallback.

## State observed before cutover

- The domain MX records point to Cloudflare Email Routing.
- The connected Gmail account is `lindsylqa@gmail.com`.
- Existing messages to both `noreply@383ks.com` and `tregu@383ks.com` are present
  in that Gmail inbox. No messages to `info@383ks.com` were found during the audit.
- The current Cloudflare API token does not expose the 383ks.com zone. Browser
  control is unavailable, so the exact forwarding rules could not be inspected.
- Newsletter production mode is currently `gmail`; its visible sender is the
  authenticated Gmail account and its Reply-To is `tregu@383ks.com`.
- Existing Resend keys are send-only: domain-list API calls are denied by scope,
  not evidence that sending credentials are invalid.
- The Resend DKIM TXT record exists at `resend._domainkey.383ks.com`.

## Prepared source changes

Public contact links, newsletter HTML/plain-text footer and web push contact now
use `info@383ks.com` instead of the old `info@383media.com`.

## Cutover procedure (completed)

1. Confirm or add an enabled Cloudflare route from `info@383ks.com` to the verified
   destination `lindsylqa@gmail.com`, or verify a catch-all provides that route.
2. With explicit user authorization, send one verification email from the new
   address to itself and independently confirm it arrives in Gmail.
3. Set production `NEWSLETTER_FROM=383 <info@383ks.com>` and
   `NEWSLETTER_MAIL_PROVIDER=resend`, preserving `NEWSLETTER_SMTP_QUEUE=1` and
   the existing encryption secret. Do not trigger a separate API/CLI deployment.
4. Set the private newsletter worker Reply-To configuration (`NEWSLETTER_FROM`)
   to `info@383ks.com`, preserving all credentials and file permissions.
5. Run build/checks, review, commit and push through the Railway GitHub release
   flow. Verify the deployed commit SHA and public contact links.

The approved Gmail fallback still exposes the authenticated Gmail sender when
Resend rejects mail for daily quota; Reply-To will be the new info address.
Receiving forwarding alone does not configure manual replies from info in Gmail.
Gmail Send mail as requires its own verified outgoing SMTP setup if requested.

## Finding incoming mail

In Gmail search `to:info@383ks.com`, or for existing domain mail use
`to:(noreply@383ks.com OR tregu@383ks.com)`.

## Validation

29 relevant newsletter/routing/branding tests pass. Production build and
TypeScript checks pass. Reviewed the address-only diff; no transport, schedule,
subscription, auth or league sender behavior has changed. Deployment follows the confirmed incoming route and successful authorized sender/delivery check.

## Delivery and configuration verification — 2026-10-21

- User confirmed creating the receiving route and authorized one verification.
- Exactly one Resend request was accepted using idempotency key
  `383-main-contact-verification-20261021`, receipt
  `01a15b61-89b0-7d75-98b9-3c833b043cf6`.
- Gmail independently confirms the message in INBOX, from `383 info@383ks.com`
  to `info@383ks.com`, subject `383 main email verification - 2026-10-21`,
  message ID `1a15b619484f4048`. This verifies both branded sending and forwarding.
- Railway NEWSLETTER_FROM is `383 <info@383ks.com>` and provider is `resend`.
  Variables were changed with `--skip-deploys`; the committed GitHub push is the
  only release trigger. Existing Gmail quota fallback remains enabled.
- Private newsletter worker Reply-To is `info@383ks.com`. A root-only backup was
  saved before changing the configuration; credentials and permissions preserved.
- Authentication, league senders, operator SMTP routing and Sunday timing unchanged.
