#!/usr/bin/env python3
"""Recent public posts by named official accounts, and the most-liked posts with a photo or
video of an event, for the article context job. X through the clip scout's account (twscrape);
Instagram through Meta's official API with our own professional account's token.

Runs inside the clip scout's environment (twscrape and instaloader live there, with its spare
accounts' cookies in /opt/data/clip-scout); news_article_context.py calls it as a subprocess.
Reads only. Input on stdin: {"x": [usernames], "ig": [usernames], "search": [X queries],
"since": iso, "until": iso}.
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
import urllib.error
import urllib.parse
import urllib.request
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


GRAPH = "https://graph.facebook.com/v27.0"
GRAPH_FIELDS = "username,media.limit({n}){{permalink,timestamp,caption,like_count,media_type,username}}"


def meta_config() -> dict | None:
    """The token and our own professional Instagram account's id, installed by ctx.sh meta."""
    try:
        config = json.loads((HOME / "meta-instagram.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return config if isinstance(config, dict) and config.get("token") and config.get("ig_user_id") else None


def discovery_url(ig_user_id: str, login: str, token: str) -> str:
    fields = f"business_discovery.username({login}){{{GRAPH_FIELDS.format(n=PER_ACCOUNT)}}}"
    return f"{GRAPH}/{ig_user_id}?fields={urllib.parse.quote(fields)}&access_token={token}"


def graph_post(media: dict) -> dict | None:
    """A post from Meta's business_discovery reply as a post link."""
    url = str(media.get("permalink") or "")
    if not re.fullmatch(r"https://www\.instagram\.com/(?:p|reel)/[\w-]{5,40}/", url):
        return None
    try:
        when = datetime.strptime(str(media.get("timestamp") or ""), "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        return None
    likes = media.get("like_count")  # left out when the owner hides likes
    return {"url": url, "date": stamp(when), "text": str(media.get("caption") or "")[:400],
            "author": str(media.get("username") or "")[:80], "likes": likes if isinstance(likes, int) and not isinstance(likes, bool) else 0}


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


def read_ig(logins: list[str]) -> list[dict]:
    """A public professional account's recent posts through Meta's official API (business_discovery).
    Instagram refuses its own pages to the VPS's data-centre address whatever the cookie, so the
    spare account's session is no longer used for this."""
    config, out = meta_config(), []
    if not config:
        print("SOCIAL instagram: no Meta token installed (bash ctx.sh meta FILE)", file=sys.stderr)
        return out
    for login in logins:
        try:  # one private or personal account must not cost the others
            req = urllib.request.Request(discovery_url(str(config["ig_user_id"]), login, str(config["token"])))
            with urllib.request.urlopen(req, timeout=20) as res:
                reply = json.loads(res.read().decode("utf-8"))
            media = ((reply.get("business_discovery") or {}).get("media") or {}).get("data") or []
            out += [p for m in media if isinstance(m, dict) and (p := graph_post(m))]
        except urllib.error.HTTPError as exc:
            try:
                error = json.loads(exc.read().decode("utf-8")).get("error") or {}
            except ValueError:
                error = {}
            if error.get("code") == 190:
                print("SOCIAL instagram: Meta token expired: make a new one and run bash ctx.sh meta FILE", file=sys.stderr)
                return out
            # 110/100 for a personal or unknown account: business_discovery reads only professional ones.
            print(f"SOCIAL instagram {login}: {error.get('code')}: {str(error.get('message') or exc)[:120]}", file=sys.stderr)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            print(f"SOCIAL instagram {login}: {type(exc).__name__}: {str(exc)[:120]}", file=sys.stderr)
    return out


def main() -> int:
    ask = json.loads((sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()) or "{}")
    since, until = datetime.fromisoformat(ask["since"]), datetime.fromisoformat(ask["until"])
    x = [n for n in ask.get("x") or [] if USERNAME.fullmatch(str(n))][:3]
    ig = [n for n in ask.get("ig") or [] if USERNAME.fullmatch(str(n))][:3]
    search = [clean_query(q) for q in ask.get("search") or []][:2]
    posts = (asyncio.run(read_x(x)) if x else []) + (read_ig(ig) if ig else [])
    found = (asyncio.run(search_x([q for q in search if q], since, until)) if any(search) else [])
    print(json.dumps(in_window(posts, since, until) + most_liked(in_window(found, since, until))[:SEARCH_KEEP], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
