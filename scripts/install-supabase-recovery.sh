#!/usr/bin/env bash
# Run on the Supabase host after the website's recovery page is live.
# Stage emails/recovery.html at /tmp/383-recovery.html first. SMTP is preserved.
set -Eeuo pipefail
root=/opt/383-supabase/current
override="$root/docker-compose.auth.yml"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/opt/383-supabase/backups/recovery-$stamp"
template="$root/volumes/auth-templates/recovery.html"
installed=0
had_template=0

rollback() {
  status=$?
  if [[ $status -ne 0 && $installed -eq 1 ]]; then
    cp "$backup/docker-compose.auth.yml" "$override"
    if [[ $had_template -eq 1 ]]; then cp "$backup/recovery.html" "$template"; fi
    (cd "$root" && sudo docker compose up -d --wait --no-deps auth studio) >/dev/null 2>&1 || true
    echo "Recovery configuration failed; previous configuration restored from $backup" >&2
  fi
  exit "$status"
}
trap rollback EXIT

test -s /tmp/383-recovery.html
grep -q 'type=recovery' /tmp/383-recovery.html
grep -q '{{ .TokenHash }}' /tmp/383-recovery.html
install -d -m 700 "$backup"
cp "$override" "$backup/docker-compose.auth.yml"
if [[ -f "$template" ]]; then
  had_template=1
  cp "$template" "$backup/recovery.html"
fi
installed=1
install -m 644 /tmp/383-recovery.html "$template"
python3 - <<'PY'
from pathlib import Path
path = Path('/opt/383-supabase/current/docker-compose.auth.yml')
text = path.read_text()
volume = '      - ./volumes/auth-templates/recovery.html:/app/apps/studio/public/recovery.html:ro'
if volume not in text:
    anchor = '  studio:\n    volumes:\n'
    if text.count(anchor) != 1:
        raise SystemExit('Unexpected Studio volumes layout; refusing to rewrite the override')
    text = text.replace(anchor, anchor + volume + '\n', 1)
for key, value in {
    'GOTRUE_MAILER_SUBJECTS_RECOVERY': '"Ndrysho fjalëkalimin — 383ks"',
    'GOTRUE_MAILER_TEMPLATES_RECOVERY': 'http://studio:3000/recovery.html',
}.items():
    if any(line.strip().startswith(key + ':') for line in text.splitlines()):
        raise SystemExit('Recovery already configured; inspect existing settings before replacing them')
    text = text.rstrip() + '\n      ' + key + ': ' + value + '\n'
path.write_text(text)
PY
cd "$root"
sudo docker compose config --quiet
sudo docker compose up -d --wait --no-deps auth studio
sudo docker exec supabase-auth sh -c 'test "$GOTRUE_MAILER_TEMPLATES_RECOVERY" = http://studio:3000/recovery.html'
echo "PASS: recovery template configured; existing SMTP sender preserved. Backup: $backup"
installed=0
