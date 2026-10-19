#!/usr/bin/env bash
set -euo pipefail
test -f /etc/383-newsletter-schedule.json
test -f /opt/383-newsletter/run_weekly_newsletter.py
id newsletter >/dev/null
chown root:newsletter /etc/383-newsletter-schedule.json
chmod 640 /etc/383-newsletter-schedule.json
cat > /etc/systemd/system/383-weekly-newsletter.service <<'UNIT'
[Unit]
Description=383 weekly recap dispatch
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=newsletter
Group=newsletter
ExecStart=/usr/bin/python3 /opt/383-newsletter/run_weekly_newsletter.py /etc/383-newsletter-schedule.json
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
TimeoutStartSec=900
UNIT
cat > /etc/systemd/system/383-weekly-newsletter.timer <<'UNIT'
[Unit]
Description=383 Sunday 10:00 Kosovo recap and retry window
[Timer]
OnCalendar=Sun *-*-* 10..23:00/15:00 Europe/Tirane
OnCalendar=Mon *-*-* 00..05:00/15:00 Europe/Tirane
AccuracySec=1s
RandomizedDelaySec=0
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemd-analyze verify /etc/systemd/system/383-weekly-newsletter.service /etc/systemd/system/383-weekly-newsletter.timer
systemctl daemon-reload
systemctl enable --now 383-weekly-newsletter.timer
systemctl is-active 383-weekly-newsletter.timer
