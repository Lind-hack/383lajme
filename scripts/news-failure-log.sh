#!/bin/sh
set -eu
# Launch/completion mail is sent directly by the hourly publisher.
# Shared legacy failure callers only write their diagnostic message.
printf "383 FAILURE (email suppressed): slot=%s reason=%s\n" "${1:-unknown-slot}" "${2:-production failure}" >&2
