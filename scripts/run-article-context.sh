#!/usr/bin/env bash
# 383's article context (383-article-context.timer, every half hour 06:10-23:40 Kosovo time):
# a "what / why" card and in-text media for newly published articles. Free Gemini only, so it
# never touches the Luna limit the news writer depends on. Kill switch: L383_ARTICLE_CONTEXT=0.
set -uo pipefail
set -a
. /opt/data/news-pipeline.env
set +a
cd /opt/data/workspaces/383lajme-news-current/scripts
PY="${L383_PYTHON_BIN:-/opt/data/workspaces/383lajme/.venv/bin/python}"
# New articles first, then a few still missing media or a reason (each tried at most three times).
exec flock -n /tmp/383-article-context.lock timeout --signal=TERM --kill-after=30s 1500s \
  sh -c '"$0" news_article_context.py --minutes 14; "$0" news_article_context.py --missing --hours 72 --limit 4 --minutes 6' "$PY"
