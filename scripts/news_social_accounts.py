#!/usr/bin/env python3
"""Recent public posts by named official accounts, and the most-liked posts with a photo or
video of an event, for the article context job.

Runs inside the clip scout's environment (twscrape and instaloader live there, with its spare
accounts' cookies in /opt/data/clip-scout); news_article_context.py calls it as a subprocess.
Reads only. Input on stdin: {"x": [usernames], "ig": [usernames], "search": [X queries],
"tags": [Instagram hashtags], "since": iso, "until": iso}.
Output on stdout: [{"url", "date", "text", "author", "likes"?}], posts between since and until;
searched posts most liked first.
A platform that fails (expired cookie, rate limit) gives no posts and one line on stderr.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOME = Path(os.environ.get("L383_SCOUT_DIR", "/opt/data/clip-scout"))
PER_ACCOUNT = 10  # newest posts looked at per account
USERNAME = re.compile(r"[A-Za-z0-9_.]{1,30}")
SEARCH_LIMIT = 30  # tweets read per search, Top tab
MIN_LIKES = 50  # some reach: a post nobody saw is rarely the moment readers want
SEARCH_KEEP = 8


def clean_query(text) -> str:
    """Plain words only: no search operators can be smuggled in from a model's answer."""
    return re.sub(r"[^\w\s'-]", " ", str(text or ""))[:80].strip()


def clean_tag(text) -> str:
    return re.sub(r"\W", "", str(text or ""))[:40]


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


def search_query(words: str, since: datetime, until: datetime) -> str:
    """X search for posts with a photo or video, by their authors, with some reach. X reads
    until: as the day before which posts stop, so the last day is let in."""
    end = (until + timedelta(days=1)).strftime("%Y-%m-%d")
    return f"{words} filter:media -filter:retweets min_faves:{MIN_LIKES} since:{since:%Y-%m-%d} until:{end}"


def searched_x_post(tw) -> dict | None:
    """A searched tweet counts only with its own photo or video: text alone shows nothing."""
    media = getattr(tw, "media", None)
    if not (getattr(media, "photos", None) or getattr(media, "videos", None)):
        return None
    post = x_post(tw)
    likes = getattr(tw, "likeCount", 0)
    return {**post, "likes": likes if isinstance(likes, int) else 0} if post else None


def most_liked(posts: list[dict]) -> list[dict]:
    seen, out = set(), []
    for post in sorted(posts, key=lambda p: -(p.get("likes") or 0)):
        if post.get("url") not in seen:
            seen.add(post.get("url"))
            out.append(post)
    return out


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


async def search_x(queries: list[str], since: datetime, until: datetime) -> list[dict]:
    from twscrape import API
    api = API(str(HOME / "x-accounts.db"))
    out = []
    for words in queries:
        try:
            async for tw in api.search(search_query(words, since, until), limit=SEARCH_LIMIT, kv={"product": "Top"}):
                if (post := searched_x_post(tw)):
                    out.append(post)
        except Exception as exc:  # the scout's account is shared: a limit here must not end the run
            print(f"SOCIAL x search: {type(exc).__name__}: {str(exc)[:120]}", file=sys.stderr)
    return out


def ig_tag_post(post) -> dict:
    likes = getattr(post, "likes", 0)
    return {**ig_post(post), "likes": likes if isinstance(likes, int) else 0}


def ig_loader():
    import http.cookiejar
    import instaloader
    loader = instaloader.Instaloader(quiet=True, download_pictures=False, download_videos=False, save_metadata=False)
    jar = http.cookiejar.MozillaCookieJar(str(HOME / "ig-cookies.txt"))
    jar.load(ignore_discard=True, ignore_expires=True)
    loader.context._session.cookies.update(jar)
    return instaloader, loader


def read_ig_tags(tags: list[str]) -> list[dict]:
    """A hashtag's top posts. Needs the scout's Instagram cookie, like the account reads."""
    out = []
    try:
        instaloader, loader = ig_loader()
    except Exception as exc:  # no instaloader or no cookie file
        print(f"SOCIAL instagram: {type(exc).__name__}: {str(exc)[:160]}", file=sys.stderr)
        return out
    for tag in tags:
        try:
            for i, post in enumerate(instaloader.Hashtag.from_name(loader.context, tag).get_top_posts()):
                if i >= SEARCH_LIMIT:
                    break
                out.append(ig_tag_post(post))
        except Exception as exc:  # most often an expired cookie: re-export ig-cookies.txt
            print(f"SOCIAL instagram #{tag}: {type(exc).__name__}: {str(exc)[:160]}", file=sys.stderr)
    return out


def read_ig(logins: list[str]) -> list[dict]:
    out = []
    try:
        instaloader, loader = ig_loader()
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
    search = [clean_query(q) for q in ask.get("search") or []][:2]
    tags = [t for t in map(clean_tag, ask.get("tags") or []) if t][:2]
    posts = (asyncio.run(read_x(x)) if x else []) + (read_ig(ig) if ig else [])
    found = (asyncio.run(search_x([q for q in search if q], since, until)) if any(search) else []) + (read_ig_tags(tags) if tags else [])
    print(json.dumps(in_window(posts, since, until) + most_liked(in_window(found, since, until))[:SEARCH_KEEP], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
