# Production deployment policy

The production domains for this repository must only be updated by Vercel's
GitHub integration after a committed push to `origin/main`.

## Never deploy the local working tree to production

- Do not use `vercel --prod`, `vercel deploy --prod`, Vercel's
  `deploy_to_vercel` tool, the deployments REST API, or a Vercel Deploy Hook.
- Do not promote or alias a CLI/API deployment to the production domains.
- Do not deploy while the Git working tree is dirty.
- News and data automations may commit and push their generated files to
  `origin/main`; they must not trigger a second deployment themselves.

Direct CLI/API deployments capture whichever checkout an agent started with.
They have previously replaced the current Tregu interface with stale commit
`8242bb0` even after a newer GitHub deployment was live.

## Required release flow

1. Pull or fetch `origin/main` and preserve unrelated user changes.
2. Run the relevant tests and `npm run build`.
3. Commit the intended files and push the commit to `origin/main`.
4. Wait for the Vercel deployment whose metadata SHA equals `origin/main`.
5. Verify `https://383lajme.vercel.app/api/deployment-info` reports that SHA.
6. For Tregu/F1 changes, also verify `race-grid-v3`, the archived F1 card on
   `/tregu`, and 22 rendered `.f1-grid-slot` elements on the market page.

If production is ever replaced by a deployment with `source: cli` or
`gitDirty: 1`, restore it by pushing a clean commit to `origin/main`. Do not
repair it with another direct production deployment.
