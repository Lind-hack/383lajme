#!/bin/sh
set -eu

# systemd is the schedule authority (383-dosje-daily.timer); this runs inside
# the Hermes container. DOSJE_ARGS carries --backfill / --dry-run for one-off
# runs started with systemd-run.
REPO="${L383_REPO:-/opt/data/workspaces/383lajme-dosje-main}"
ENV_FILE="${DOSJE_ENV_FILE:-/opt/data/tregu-daily.env}"
[ -r "$ENV_FILE" ] || { echo '{"ok":false,"error":"protected environment unavailable"}' >&2; exit 1; }
set -a
. "$ENV_FILE"
set +a
cd "$REPO"

# The script stops starting model calls at 06:40 by itself; this is the
# outer bound in case a call hangs.
# shellcheck disable=SC2086
exec timeout 6600s node scripts/run-dosje-daily.mjs ${DOSJE_ARGS:-}
