#!/usr/bin/env bash
set -Eeuo pipefail
# Stage operator_mail_worker.py in /tmp/383-operator-mail first.
test -r /etc/383-newsletter.json
test -s /opt/383-newsletter/newsletter_mail_worker.py
install -m 644 /tmp/383-operator-mail/operator_mail_worker.py /opt/383-newsletter/operator_mail_worker.py
cat >/etc/systemd/system/383-operator-mail.service <<'UNIT'
[Unit]
Description=383 private operator Gmail SMTP queue
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=newsletter
Group=newsletter
ExecStart=/usr/bin/python3 /opt/383-newsletter/operator_mail_worker.py /etc/383-newsletter.json
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
TimeoutStartSec=240
UNIT
cat >/etc/systemd/system/383-operator-mail.timer <<'UNIT'
[Unit]
Description=Deliver private 383 operator reports through Gmail
[Timer]
OnBootSec=15s
OnUnitActiveSec=15s
Unit=383-operator-mail.service
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now 383-operator-mail.timer
