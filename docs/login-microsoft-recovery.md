# Microsoft login and password recovery

The login page is `/hyr`. Microsoft appears below Google. The forgotten-password
link opens `/hyr/fjalekalimi`; authenticated recovery links open the same page
with `?mode=reset`. Recovery uses Supabase Auth's existing SMTP configuration
and sender, `noreply@383ks.com`. No additional mail service is required.

## Enable Microsoft in the self-hosted Auth service

1. In Microsoft Entra admin center, create an **App registration**. For public
   signup, select organizational directories **and personal Microsoft accounts**.
2. Add a **Web** redirect URI:
   `https://supabase.383ks.com/auth/v1/callback`.
3. Record the **Application (client) ID**. Create a client secret and securely
   save its **value** (not the secret ID), together with its expiration date.
   Do not put the secret in Git or chat.
4. Add the Microsoft Graph delegated `email` permission. Follow Supabase's
   linked Azure guide to include the `email` and `xms_edov` optional claims in
   the app manifest, so Auth can identify verified email addresses. The website
   explicitly requests the `email` scope, which Supabase requires.
5. On the Supabase host, use a protected editor to add `AZURE_CLIENT_ID` and
   `AZURE_SECRET` to `/opt/383-supabase/current/.env` (retain mode `0600`).
6. Back up `docker-compose.auth.yml` and add these entries to its existing
   `auth.environment` mapping, preserving Google, SMTP and mail templates:

   ```yaml
   GOTRUE_EXTERNAL_AZURE_ENABLED: "true"
   GOTRUE_EXTERNAL_AZURE_CLIENT_ID: ${AZURE_CLIENT_ID}
   GOTRUE_EXTERNAL_AZURE_SECRET: ${AZURE_SECRET}
   GOTRUE_EXTERNAL_AZURE_REDIRECT_URI: ${API_EXTERNAL_URL}/callback
   GOTRUE_EXTERNAL_AZURE_URL: https://login.microsoftonline.com/common
   ```

7. From `/opt/383-supabase/current`, run `sudo docker compose config --quiet`,
   then `sudo docker compose up -d --wait --no-deps auth`. Check public Auth
   settings report `external.azure: true`. Test **Hyr me Microsoft** using an
   actual Microsoft account and verify return to the original `next` destination.
   Schedule renewal of the client secret before it expires.

The Microsoft provider cannot authenticate users until those credentials exist.
The website shows a clear message if the provider is disabled.

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

References: [Supabase Microsoft login](https://supabase.com/docs/guides/auth/social-login/auth-azure)
and [password recovery](https://supabase.com/docs/guides/auth/passwords).
