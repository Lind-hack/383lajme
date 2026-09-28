#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="${1:-/opt/data/workspaces/383lajme-prod-f731569}"
test "$(id -u)" -eq 0
test -f "$repo_dir/scripts/run-tregu-market-emails.sh"
test -f "$repo_dir/scripts/run-tregu-market-emails.mjs"
test -f "$repo_dir/.env.automation"

cat > /etc/systemd/system/383-tregu-market-email.service <<EOF
[Unit]
Description=Deliver queued 383 non-sports market opening emails
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec --user hermes --env HOME=/opt/data/home --env L383_REPO=$repo_dir hermes /bin/sh $repo_dir/scripts/run-tregu-market-emails.sh
TimeoutStartSec=75
StandardOutput=journal
StandardError=journal
EOF

cat > /etc/systemd/system/383-tregu-market-email.timer <<'EOF'
[Unit]
Description=Retry queued 383 non-sports market opening emails every minute

[Timer]
OnCalendar=*-*-* *:*:00 UTC
Persistent=false
AccuracySec=1s
Unit=383-tregu-market-email.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now 383-tregu-market-email.timer
systemctl list-timers 383-tregu-market-email.timer --no-pager
