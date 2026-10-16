# Password recovery

The login page is `/hyr`, with email/password and Google login. The forgotten-password
link opens `/hyr/fjalekalimi`; authenticated recovery links open the same page
with `?mode=reset`. Recovery uses Supabase Auth's existing SMTP configuration
and sender, `noreply@383ks.com`. No additional mail service is required.

## Install the recovery email template

First deploy the website through the repository's GitHub release flow. Stage
`emails/recovery.html` as `/tmp/383-recovery.html` on the Supabase host. Run
`scripts/install-supabase-recovery.sh` there as the deployment user. It backs up
the current Auth override, serves the template through Studio, and configures
the recovery subject/body while retaining the existing SMTP credentials.

The template uses `TokenHash` and `type=recovery` via `/auth/confirm`, allowing
the email to be opened on a different device. The confirmation handler verifies
the token and writes the session cookie before opening the password editor.
The existing `/auth/callback**` redirect allowlist also covers the PKCE fallback.

## Verify

- `node --test lib/auth-recovery.test.mjs lib/auth-public-origin.test.mjs`
- `node scripts/check-auth-flow.mjs http://localhost:3105` against the local app.
  This uses intercepted Auth requests and does not send mail or change accounts.
- `npm test` and `npm run build` before release.
- Request a reset for an authorized test account. Confirm the email arrives
  from `noreply@383ks.com`, open the link, save a new password, sign out, and
  verify the new password works while the previous password fails.
- Reopen the consumed link: it must offer a new reset request.

Reference: [Supabase password recovery](https://supabase.com/docs/guides/auth/passwords).
