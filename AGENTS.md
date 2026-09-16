# Production deployment policy

The production domains for this repository must only be updated by Railway's
GitHub integration after a committed push to `origin/main`.

## Never deploy the local working tree to production

- Do not use `railway up`, a Railway API deployment, a deploy hook, or any other
  direct upload of a local checkout.
- Do not redeploy, promote, or alias an arbitrary Railway deployment to the
  production domains.
- Do not deploy while the Git working tree is dirty.
- News and data automations may commit and push generated files to `origin/main`;
  Railway's GitHub integration remains the only deployment mechanism.

Direct CLI/API deployments capture whichever checkout an agent started with and
can replace the current application with stale or unfinished work.

## Required release flow

1. Fetch `origin/main` and prepare the release from a clean worktree based on it,
   preserving unrelated user changes.
2. Run the relevant tests and `npm run build`.
3. Commit only the intended files and push the commit to `origin/main`.
4. Wait for the Railway `production` deployment whose Git commit SHA equals
   `origin/main`.
5. Verify `https://www.383ks.com/api/deployment-info` reports that SHA, branch
   `main`, environment `production`, and source `github-main`.
6. For Tregu/F1 changes, also verify `race-grid-v3`, the archived F1 card on
   `/tregu`, and 22 rendered `.f1-grid-slot` elements on the market page.

If production ever reports an unverified source or a SHA different from
`origin/main`, restore it with a clean corrective commit pushed to `origin/main`.
Do not repair it with a direct Railway deployment.
