# Private automation dashboard

Open `/admin/automation` after signing into the existing admin account. The page
refreshes every 15 seconds and shows the five application jobs plus other VPS systemd timers, start/end times, observed
stage, next timer execution, discovered news, draft batches and public social leads.
Reports older than 90 seconds are marked stale; their running clocks freeze.

The VPS runs `383-automation-status.timer` every 30 seconds. Its oneshot service
calls `/usr/local/lib/383-automation/collect.py` (source:
`scripts/collect-automation-status.py`). That script reads the five named application units and discovers other systemd timers
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
For independent category runs, the publisher reads each desk's private workspace
and hourly outcome. Only a desk with completed live verification whose batch matches an exact Supabase
readback is marked published; that readback is cached by batch key and file
checksum. Drafts and changed files cannot reuse a successful readback. Seven
category cards show independent results, including a recovered retry, while
the original failed parent attempt remains recorded. Same-hour batches have
distinct identifiers and category labels. Discovery summaries combine the seven
desks and include bounded source cards from each category.
An email failure keeps the verified publication count and displays the delivery
error separately. A stopped worker is not shown as running forever, while a
newer independent retry is not labelled failed by an older parent attempt.

Check collection: `sudo systemctl status 383-automation-status.service`.
Pause collection: `sudo systemctl stop 383-automation-status.timer`.
This does not stop any news, social or market job.

Runnable state check: `python scripts/test-automation-status.py`.
Website code follows the repository's committed GitHub-main release flow.
