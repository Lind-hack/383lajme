#!/bin/sh
# Run on the VPS only after the clean source revision has passed checks.
set -eu
HOST_DATA=/home/ubuntu/.hermes
SOURCE="$HOST_DATA/workspaces/383lajme-tregu-main"
REPO=/opt/data/workspaces/383lajme-tregu-main
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$HOST_DATA/automation/reliability-backup-$stamp"
mkdir -p "$backup"
chmod 700 "$backup"
test -f "$SOURCE/scripts/run-tregu-worker.sh"
test -f "$HOST_DATA/automation/tregu.env"
# Retain all previous effective units for rollback; never delete old releases.
systemctl cat 383-tregu-reprice.service 383-tregu-research.service 383-tregu-monitor-failure@.service > "$backup/previous-units.txt"
for name in run-tregu-worker.sh automation_http.py bota_email_report.py run-bota-gpt.py run-bota-gpt-email.py; do
  if test -f "$HOST_DATA/scripts/$name"; then cp -p "$HOST_DATA/scripts/$name" "$backup/$name"; fi
  install -m 644 "$SOURCE/scripts/$name" "$HOST_DATA/scripts/$name"
done
chown --reference="$SOURCE/scripts/run-tregu-worker.sh" "$HOST_DATA/scripts/run-tregu-worker.sh" "$HOST_DATA/scripts/automation_http.py" "$HOST_DATA/scripts/bota_email_report.py" "$HOST_DATA/scripts/run-bota-gpt.py" "$HOST_DATA/scripts/run-bota-gpt-email.py"
for pair in '383-tregu-reprice.service reprice' '383-tregu-research.service research' '383-tregu-monitor-failure@.service alert'; do
  set -- $pair
  service=$1
  action=$2
  directory="/etc/systemd/system/$service.d"
  mkdir -p "$directory"
  if test -f "$directory/zz-stable-runtime.conf"; then cp -p "$directory/zz-stable-runtime.conf" "$backup/$service.conf"; fi
  argument=''
  if test "$action" = alert; then argument=' %i'; fi
  cat > "$directory/zz-stable-runtime.conf" <<EOF
[Service]
Environment=L383_REPO=$REPO
ExecStart=
ExecStart=/usr/bin/docker exec --user hermes --env HOME=/opt/data/home --env L383_REPO=$REPO hermes /bin/sh /opt/data/scripts/run-tregu-worker.sh $action$argument
EOF
done
systemctl daemon-reload
systemctl enable 383-tregu-research.timer 383-tregu-reprice.timer
systemctl start 383-tregu-research.timer 383-tregu-reprice.timer
echo "Installed stable automation runners; rollback files: $backup"
