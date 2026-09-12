# Private automation dashboard

Open `/admin/automation` after signing into the existing admin account. The page
refreshes every 15 seconds and shows the five VPS jobs, start/end times, observed
stage, next timer execution, discovered news, draft batches and public social leads.
Reports older than 90 seconds are marked stale; their running clocks freeze.

The VPS runs `383-automation-status.timer` every 30 seconds. Its oneshot service
calls `/usr/local/lib/383-automation/collect.py` (source:
`scripts/collect-automation-status.py`). That script reads only five named units
and passes structured fields to the container's
`/opt/data/scripts/publish-automation-status.py`.

The publisher uses the existing production Supabase service credentials and writes
`automation-status/latest.json` in a **private** Storage bucket. The server-only
admin API downloads it after checking the signed admin cookie. No service keys,
raw journal output, article bodies or model conversations go into the snapshot.

Publication is marked verified only when a published quality receipt matches the
batch checksum. Draft counts are not publication counts. The stage is the last
recognized stage in the service journal, rather than a percentage estimate.
Historical batches without matching receipts remain unverified.

Check collection: `sudo systemctl status 383-automation-status.service`.
Pause collection: `sudo systemctl stop 383-automation-status.timer`.
This does not stop any news, social or market job.

Runnable state check: `python scripts/test-automation-status.py`.
Website code follows the repository's committed GitHub-main release flow.
