#!/bin/sh
set -eu

repo_dir=${L383_REPO:-/opt/data/workspaces/383lajme-prod-f731569}
test -f "$repo_dir/.env.automation"
test -f "$repo_dir/scripts/run-tregu-market-emails.mjs"
set -a
. "$repo_dir/.env.automation"
set +a
cd "$repo_dir"
exec node scripts/run-tregu-market-emails.mjs
