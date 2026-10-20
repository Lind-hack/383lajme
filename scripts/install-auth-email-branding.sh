#!/usr/bin/env bash
set -Eeuo pipefail
root=/opt/383-supabase/current/volumes/auth-templates
backup=/opt/383-supabase/backups/email-branding-$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 "$backup"
for template in confirm-signup recovery; do
 test -s "/tmp/383-email-branding/$template.html"
 test -s "$root/$template.html"
 grep -q 'https://383ks.com/email/383-logo-animated.gif' "/tmp/383-email-branding/$template.html"
 cp "$root/$template.html" "$backup/$template.html"
 # Preserve each bind-mounted inode so Studio immediately serves the new HTML.
 cat "/tmp/383-email-branding/$template.html" > "$root/$template.html"
 docker exec supabase-studio grep -q '383-logo-animated.gif' "/app/apps/studio/public/$template.html"
done
printf 'PASS: confirmation and recovery templates updated; SMTP and auth settings preserved.\n'
