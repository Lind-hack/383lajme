#!/usr/bin/env bash
set -euo pipefail
# Upload the worker and root-only settings before running this installer.
test -f /etc/383-newsletter.json
test -f /opt/383-newsletter/newsletter_mail_worker.py
python3 -c 'import cryptography'
id newsletter >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin newsletter
chown root:newsletter /etc/383-newsletter.json
chmod 640 /etc/383-newsletter.json
chmod 755 /opt/383-newsletter /opt/383-newsletter/newsletter_mail_worker.py
cat > /etc/systemd/system/383-newsletter-mail.service <<'UNIT'
[Unit]
Description=383 private newsletter mail queue
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=newsletter
Group=newsletter
ExecStart=/usr/bin/python3 /opt/383-newsletter/newsletter_mail_worker.py /etc/383-newsletter.json
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
TimeoutStartSec=180
UNIT
cat > /etc/systemd/system/383-newsletter-mail.timer <<'UNIT'
[Unit]
Description=Deliver queued 383 newsletter mail
[Timer]
OnBootSec=15s
OnUnitInactiveSec=15s
AccuracySec=1s
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now 383-newsletter-mail.timer
systemctl start 383-newsletter-mail.service
systemctl is-active 383-newsletter-mail.timer
