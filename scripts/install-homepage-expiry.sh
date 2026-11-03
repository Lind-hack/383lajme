#!/usr/bin/env bash
# Install as root after setting the placement's ends_at in Supabase.
set -euo pipefail
expiry=$(date -u -d "${1:?Pass the placement ends_at timestamp}" '+%Y-%m-%d %H:%M:%S UTC')
env_file=${2:?Pass the existing automation environment file}
test -f "$env_file"
install -d -m 755 /opt/383-homepage
install -m 755 "$(dirname "$0")/revalidate-homepage.py" /opt/383-homepage/revalidate-homepage.py
cat >/etc/systemd/system/383-homepage-placement-expiry.service <<EOF
[Unit]
Description=Refresh 383 homepage after the timed editorial lead expires
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /opt/383-homepage/revalidate-homepage.py --env-file $env_file
TimeoutStartSec=180
Restart=on-failure
RestartSec=60
EOF
cat >/etc/systemd/system/383-homepage-placement-expiry.timer <<EOF
[Unit]
Description=Expire the 383 editorial homepage placement

[Timer]
OnCalendar=$expiry
AccuracySec=1s
RandomizedDelaySec=0
Persistent=true
Unit=383-homepage-placement-expiry.service

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable 383-homepage-placement-expiry.timer
systemctl restart 383-homepage-placement-expiry.timer
systemctl list-timers 383-homepage-placement-expiry.timer --no-pager
