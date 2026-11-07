#!/usr/bin/env python3
"""Recent public posts by named official accounts, for the article context job.

Runs inside the clip scout's environment (twscrape and instaloader live there, with its spare
accounts' cookies in /opt/data/clip-scout); news_article_context.py calls it as a subprocess.
Reads only. Input on stdin: {"x": [usernames], "ig": [usernames], "since": iso, "until": iso}.
Output on stdout: [{"url", "date", "text", "author"}], posts between since and until.
A platform that fails (expired cookie, rate limit) gives no posts and one line on stderr.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(os.environ.get("L383_SCOUT_DIR", "/opt/data/clip-scout"))
PER_ACCOUNT = 10  # newest posts looked at per account
USERNAME = re.compile(r"[A-Za-z0-9_.]{1,30}")


def stamp(value) -> str:
    when = value if isinstance(value, datetime) else None
    if when is None:
        return ""
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(timezone.utc).isoformat()


def in_window(posts: list[dict], since: datetime, until: datetime) -> list[dict]:
    kept = []
    for post in posts:
        try:
            when = datetime.fromisoformat(str(post.get("date") or ""))
        except ValueError:
            continue
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        if since <= when <= until:
            kept.append(post)
    return kept


def x_post(tw) -> dict | None:
    """A tweet as a link to the post. A repost is someone else's words, so it is skipped."""
    if getattr(tw, "retweetedTweet", None) is not None:
        return None
    user = getattr(tw, "user", None)
    login = getattr(user, "username", "")
    if not USERNAME.fullmatch(str(login)):
        return None
    return {"url": f"https://x.com/{login}/status/{tw.id}", "date": stamp(tw.date),
            "text": str(getattr(tw, "rawContent", "") or "")[:400], "author": str(getattr(user, "displayname", "") or login)[:80]}


def ig_post(post) -> dict:
    return {"url": f"https://www.instagram.com/p/{post.shortcode}/", "date": stamp(post.date_utc),
            "text": str(post.caption or "")[:400], "author": str(getattr(post, "owner_username", "") or "")[:80]}


async def read_x(logins: list[str]) -> list[dict]:
    from twscrape import API
    api = API(str(HOME / "x-accounts.db"))
    out = []
    for login in logins:
        try:
            user = await api.user_by_login(login)
            if not user:
                continue
            async for tw in api.user_tweets(user.id, limit=PER_ACCOUNT):
                if (post := x_post(tw)):
                    out.append(post)
        except Exception as exc:  # the scout's account is shared: a limit here must not end the run
            print(f"SOCIAL x {login}: {type(exc).__name__}: {str(exc)[:120]}", file=sys.stderr)
    return out


def read_ig(logins: list[str]) -> list[dict]:
    out = []
    try:
        import http.cookiejar
        import instaloader
        loader = instaloader.Instaloader(quiet=True, download_pictures=False, download_videos=False, save_metadata=False)
        jar = http.cookiejar.MozillaCookieJar(str(HOME / "ig-cookies.txt"))
        jar.load(ignore_discard=True, ignore_expires=True)
        loader.context._session.cookies.update(jar)
    except Exception as exc:  # no instaloader or no cookie file
        print(f"SOCIAL instagram: {type(exc).__name__}: {str(exc)[:160]}", file=sys.stderr)
        return out
    for login in logins:
        try:  # one missing profile must not cost the others
            profile = instaloader.Profile.from_username(loader.context, login)
            for i, post in enumerate(profile.get_posts()):
                if i >= PER_ACCOUNT:
                    break
                out.append(ig_post(post))
        except Exception as exc:  # most often an expired cookie: re-export ig-cookies.txt
            print(f"SOCIAL instagram {login}: {type(exc).__name__}: {str(exc)[:160]}", file=sys.stderr)
    return out


def main() -> int:
    ask = json.loads((sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()) or "{}")
    since, until = datetime.fromisoformat(ask["since"]), datetime.fromisoformat(ask["until"])
    x = [n for n in ask.get("x") or [] if USERNAME.fullmatch(str(n))][:3]
    ig = [n for n in ask.get("ig") or [] if USERNAME.fullmatch(str(n))][:3]
    posts = (asyncio.run(read_x(x)) if x else []) + (read_ig(ig) if ig else [])
    print(json.dumps(in_window(posts, since, until), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
