#!/bin/sh
# Called by 383-dosje-daily.service (ExecStopPost) when the unit did not
# succeed. Deliberately independent of the dosje workspace: on 31 Oct 2026 the
# workspace vanished and every run died before it could send its own email, so
# the failure went unnoticed for days. Lives on the host, needs only the
# container's env file and node.
# $1 = systemd's SERVICE_RESULT
[ "${1:-}" = success ] && exit 0
exec /usr/bin/docker exec -i --user hermes hermes /bin/sh -c '
  set -a; . /opt/data/tregu-daily.env; set +a
  REASON="$0" node --input-type=module -' "${1:-unknown}" <<'JS'
import { existsSync, statSync } from "node:fs";
const mark = "/tmp/383-dosje-reported";
// The run sent its own email (it reports its own errors); do not send a second.
if (existsSync(mark) && Date.now() - statSync(mark).mtimeMs < 4 * 3600_000) process.exit(0);
const base = (process.env.DOSJE_AUTOMATION_URL || process.env.TREGU_AUTOMATION_URL || "").replace(/\/$/, "");
const secret = process.env.TREGU_AUTOMATION_SECRET || process.env.CRON_SECRET || "";
const res = await fetch(`${base}/api/automation/dosje/daily/report`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
  body: JSON.stringify({
    date: new Date().toISOString(),
    mode: "daily",
    runId: `failure-${new Date().toISOString().slice(0, 13)}`,
    subjects: [],
    errors: [`Ekzekutimi nuk përfundoi (systemd: ${process.env.REASON}). Shih: journalctl -u 383-dosje-daily`],
  }),
}).catch((err) => ({ ok: false, status: String(err) }));
console.log(JSON.stringify({ stage: "failure_report", sent: res.ok, status: res.status }));
process.exit(res.ok ? 0 : 1);
JS
