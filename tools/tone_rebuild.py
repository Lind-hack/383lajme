#!/usr/bin/env python3
"""Re-derive the published tone index from the cache, with the corrected rules.

The scraper runs every ninety minutes, so a fix to its rules would otherwise
take until the next run to reach a reader — and the run only ever re-examines
the last three days. Everything needed to rebuild is already in
public/tone-article-cache.json: outlet, url, stance, date, first seen. This
applies tools/tone_sources.py to that cache and rewrites the published file, so
a correction lands the moment it is committed.

It also writes public/tone-outlet-history.json, a ledger that accumulates per
outlet rather than only per country. The cache keeps seven days; the ledger
keeps everything, which is what makes "Die Presse has covered Kosovo fourteen
times this year, trending critical" answerable at all.

    python tools/tone_rebuild.py [--dry]
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tone_sources import country_for, is_editorial, is_local_placename  # noqa: E402

ROOT = Path(__file__).parent.parent
CACHE_PATH = ROOT / "public" / "tone-article-cache.json"
OUTLETS_PATH = ROOT / "public" / "tone-outlets.json"
HISTORY_PATH = ROOT / "public" / "tone-history.json"
LEDGER_PATH = ROOT / "public" / "tone-outlet-history.json"

VALID_STANCES = {"positive", "neutral", "negative"}
UNKNOWN = "unknown"
MIN_CONFIDENT_N = 5
MIN_CONFIDENT_COVERAGE = 0.4
MAX_ARTICLES_PER_OUTLET = 6
#: How far a country's index must move before it is worth explaining.
MOVEMENT_THRESHOLD = 4
#: Bumped from 2 when attribution moved from the Google News feed that found an
#: article to the outlet that published it, and non-editorial sources stopped
#: counting. A number produced under these rules is not comparable with one
#: produced before them, and summarizeToneHistory() will not subtract across it.
#: 4: "good or bad news for Kosovo's image abroad" (see tone_scraper.py). From
#: v4 on, a history row's overallIndex is that DAY's index — articles first
#: seen on that date — not a rolling average over the seven-day cache, which
#: is what kept the number flat. Must equal tone_scraper.STANCE_SCHEMA_VERSION.
STANCE_VERSION = 4
#: Below this many scored articles a day has no index: one story would swing it.
MIN_DAY_N = 5
#: Share of a day's scored articles that must carry the current definition
#: before the day gets an index (see day_stats).
DAY_CONVERTED_SHARE = 0.9


def is_confident(scored: int, excluded: int) -> bool:
    if scored < MIN_CONFIDENT_N:
        return False
    total = scored + excluded
    return total == 0 or (scored / total) >= MIN_CONFIDENT_COVERAGE


#: Same constant and formula as tone_scraper.country_index — see its docstring.
INDEX_SMOOTHING = 3


def country_index(positive: int, neutral: int, negative: int) -> int | None:
    if not positive + neutral + negative:
        return None
    return round(50 + 50 * (positive - negative) / (positive + negative + INDEX_SMOOTHING))


def trend_of(counts: Counter) -> str:
    """One word for how an outlet has leaned across everything we hold."""
    pos, neg = counts.get("positive", 0), counts.get("negative", 0)
    scored = pos + neg + counts.get("neutral", 0)
    if scored < 3:
        return "i pamjaftueshëm"
    if pos > neg * 2 and pos >= 2:
        return "pozitiv"
    if neg > pos * 2 and neg >= 2:
        return "kritik"
    if pos or neg:
        return "i përzier"
    return "neutral"


def load_ledger() -> dict:
    if LEDGER_PATH.exists():
        try:
            return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"version": 1, "outlets": {}}


def day_stats(articles: list[dict], day: str) -> dict | None:
    """The index for one calendar day (UTC, the scraper's own date key).

    Only articles scored under the current definition count. Returns None
    until the day is converted: the scraper's rescore queue works through the
    cache newest-first, and a day read half under each definition is not one
    reading. "Converted" means DAY_CONVERTED_SHARE of its scored articles —
    unreadable ones count for nothing either way, and one stubborn article
    should not keep a whole day off the chart."""
    of_day = [a for a in articles if (a.get("firstSeen") or a.get("date")) == day]
    scored = [a for a in of_day if a.get("sentiment") in VALID_STANCES]
    current = [a for a in of_day if a.get("stanceVersion") == STANCE_VERSION]
    current_scored = [a for a in current if a.get("sentiment") in VALID_STANCES]
    if not current:
        return None
    if scored and len(current_scored) / len(scored) < DAY_CONVERTED_SHARE:
        return None
    of_day = current
    counts = Counter(a.get("sentiment") for a in of_day)
    pos, neu, neg = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
    n = pos + neu + neg
    return {
        "index": country_index(pos, neu, neg) if n >= MIN_DAY_N else None,
        "positive": pos,
        "neutral": neu,
        "negative": neg,
        "unknown": counts.get(UNKNOWN, 0),
        "n": n,
        "sourceCount": len({a.get("outlet") for a in of_day if a.get("sentiment") in VALID_STANCES}),
    }


def main() -> int:
    dry = "--dry" in sys.argv
    cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))["articles"]
    previous = json.loads(OUTLETS_PATH.read_text(encoding="utf-8"))
    history = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    ledger = load_ledger()

    # The ledger accumulates and is never rebuilt, which means it keeps whatever
    # the rules allowed on the day an entry was written. The Hellenic Volleyball
    # Federation was still sitting in it as a masthead, added before federations
    # were excluded. Anything that would not be admitted today is dropped now,
    # or "who watches Kosovo" answers with a governing body announcing fixtures.
    stale = [
        name for name, rec in ledger["outlets"].items()
        if not is_editorial(name, (rec.get("urls") or [""])[0])
    ]
    for name in stale:
        del ledger["outlets"][name]
    if stale:
        print(f"ledger          : dropped {len(stale)} source(s) that no longer qualify "
              f"({', '.join(stale[:3])})")

    dropped = Counter()
    by_country: dict[str, list[dict]] = defaultdict(list)

    for entry in cache.values():
        url, outlet = entry.get("url", ""), entry.get("outlet", "")
        if not is_editorial(outlet, url):
            dropped["non_editorial"] += 1
            continue
        if is_local_placename(entry.get("title", ""), entry.get("blurb", "") or entry.get("summary", "")):
            dropped["wrong_kosovo"] += 1
            continue
        country = country_for(url, outlet)
        if not country:
            dropped["unattributable"] += 1
            continue
        by_country[country].append({**entry, "country": country})

    # ── The published file ───────────────────────────────────────────────────
    countries_data: dict[str, dict] = {}
    summaries: dict[str, dict] = {}
    today = date.today().isoformat()

    prev_entry = history[-2] if len(history) >= 2 else (history[-1] if history else None)

    for country in previous["countries"]:
        # Newest first, so the per-outlet cap below keeps today's articles
        # rather than whatever the cache happened to hold longest. The daily
        # story list on /bota-per-kosoven reads today's articles from here.
        rows = sorted(by_country.get(country, []),
                      key=lambda e: e.get("firstSeen") or e.get("date") or "", reverse=True)
        by_outlet: dict[str, list[dict]] = defaultdict(list)
        flat: list[dict] = []

        for entry in rows:
            article = {
                "title": entry["title"],
                "albanianTitle": entry.get("albanianTitle"),
                "blurb": entry.get("blurb", ""),
                "imageUrl": entry.get("imageUrl"),
                "url": entry["url"],
                "date": entry["date"],
                "sentiment": entry["sentiment"],
                "reason": entry.get("stanceReason", ""),
                "isQuote": bool(entry.get("isQuote", False)),
                "evidence": entry.get("evidence", ""),
                "speaker": entry.get("speaker", ""),
                # What the daily story list needs: which day the article
                # belongs to, and whether its label is the current definition.
                "firstSeen": entry.get("firstSeen") or entry["date"],
                "stanceVersion": entry.get("stanceVersion"),
            }
            by_outlet[entry.get("outlet") or "—"].append(article)
            flat.append({**article, "outlet": entry.get("outlet") or "—"})

            # The ledger grows; it is never rebuilt from the seven-day cache.
            slot = ledger["outlets"].setdefault(
                entry.get("outlet") or "—",
                {"country": country, "total": 0, "positive": 0, "neutral": 0,
                 "negative": 0, "unknown": 0, "firstSeen": entry.get("firstSeen") or entry["date"],
                 "lastSeen": entry["date"], "urls": []},
            )
            if entry["url"] not in slot["urls"]:
                slot["urls"].append(entry["url"])
                slot["total"] += 1
                slot[entry["sentiment"] if entry["sentiment"] in VALID_STANCES else "unknown"] += 1
            slot["country"] = country
            slot["lastSeen"] = max(slot["lastSeen"], entry["date"])
            slot["firstSeen"] = min(slot["firstSeen"], entry.get("firstSeen") or entry["date"])

        outlets_list = []
        for name, arts in sorted(by_outlet.items()):
            arts = arts[:MAX_ARTICLES_PER_OUTLET]
            scored = [a for a in arts if a["sentiment"] in VALID_STANCES]
            vote = Counter(a["sentiment"] for a in scored).most_common(1)[0][0] if scored else UNKNOWN
            record = ledger["outlets"].get(name, {})
            outlets_list.append({
                "name": name,
                "sentiment": vote,
                "articleCount": len(arts),
                "articles": arts,
                # Per-outlet history, so a reader can see that this masthead is
                # a regular observer rather than a one-off hit.
                "totalArticles": record.get("total", len(arts)),
                "trend": trend_of(Counter({k: record.get(k, 0) for k in
                                           ("positive", "neutral", "negative")})),
                "firstSeen": record.get("firstSeen"),
                "lastSeen": record.get("lastSeen"),
            })

        # Articles still carrying an older definition's label are pending the
        # scraper's rescore queue. They count as excluded, not as scores, so a
        # country's index never mixes two definitions.
        current = [e for e in rows if e.get("stanceVersion") == STANCE_VERSION]
        counts = Counter(e["sentiment"] for e in current)
        pos, neu, neg = counts.get("positive", 0), counts.get("neutral", 0), counts.get("negative", 0)
        excluded = counts.get(UNKNOWN, 0) + (len(rows) - len(current))
        n = pos + neu + neg
        idx = country_index(pos, neu, neg)

        summary = {
            "index": idx,
            "positive": round(100 * pos / n) if n else 0,
            "neutral": round(100 * neu / n) if n else 0,
            "negative": round(100 * neg / n) if n else 0,
            "n": n,
            "excluded": excluded,
            "confident": is_confident(n, excluded),
            "stanceVersion": STANCE_VERSION,
        }

        # ── Why it moved ─────────────────────────────────────────────────────
        # Only when the move is big enough to be worth a sentence, and only
        # ever pointing at an article the reader can open. A generated
        # explanation with nothing behind it is the thing this feature cannot
        # afford.
        before = (prev_entry or {}).get("countries", {}).get(country, {}).get("index")
        if idx is not None and before is not None and abs(idx - before) >= MOVEMENT_THRESHOLD:
            direction = "positive" if idx > before else "negative"
            drivers = [a for a in flat if a["sentiment"] == direction and a.get("evidence")]
            drivers.sort(key=lambda a: len(a.get("evidence", "")), reverse=True)
            if drivers:
                d = drivers[0]
                summary["movement"] = {
                    "delta": idx - before,
                    "from": before,
                    "outlet": d["outlet"],
                    "title": d.get("albanianTitle") or d["title"],
                    "evidence": d.get("evidence", "")[:240],
                    "url": d["url"],
                }

        countries_data[country] = {"outlets": outlets_list, "summary": summary}
        summaries[country] = summary

    total = sum(s["n"] for s in summaries.values())
    weighted = sum(s["index"] * s["n"] for s in summaries.values() if s["index"] is not None)
    output = {
        "lastUpdated": previous.get("lastUpdated", today),
        "overallIndex": round(weighted / total) if total else None,
        "totalArticles": total,
        "sourceCount": sum(len(c["outlets"]) for c in countries_data.values()),
        "stanceVersion": STANCE_VERSION,
        # Said out loud rather than hidden. An article from a newsroom we
        # cannot place — a generic domain we do not recognise, or a country
        # outside the fifteen — is counted nowhere, and a reader checking the
        # method deserves to see how large that pile is instead of wondering
        # why the totals do not add up.
        "unattributed": dropped["unattributable"],
        "nonEditorial": dropped["non_editorial"],
        "wrongKosovo": dropped["wrong_kosovo"],
        "countries": countries_data,
    }

    print(f"cache rows      : {len(cache)}")
    for reason, count in dropped.most_common():
        print(f"  dropped {reason:16} {count}")
    print(f"kept            : {total} articles across "
          f"{sum(1 for s in summaries.values() if s['n'])} countries")
    print(f"overall index   : {previous.get('overallIndex')} -> {output['overallIndex']}")
    print(f"outlet ledger   : {len(ledger['outlets'])} mastheads")
    print()
    for name, s in sorted(summaries.items(), key=lambda kv: -kv[1]["n"]):
        flag = "" if s["confident"] else "   (not enough coverage)"
        moved = f"   moved {s['movement']['delta']:+d}" if "movement" in s else ""
        print(f"  {name[:10]:10} n={s['n']:3}  index={str(s['index']):>4}{flag}{moved}")

    # ── The daily row the dashboard actually reads ───────────────────────────
    #
    # The homepage tone dashboard renders summarizeToneHistory(), which reads
    # the LAST row of tone-history.json — not tone-outlets.json. Rebuilding
    # only the outlets file corrected every drill-down and left the headline
    # saying "248 artikuj ne 15 vende" under the old attribution, which is the
    # first thing a reader sees.
    #
    # Today's row is replaced rather than appended: it is one day recomputed
    # under corrected rules, not a new day. Earlier rows are left as they are —
    # the articles behind them are long out of the cache, and silently
    # restating history we cannot recompute would be worse than leaving it
    # visibly on the old method.
    #
    # stanceVersion 3 marks the boundary. summarizeToneHistory() already
    # refuses to subtract across a version change, so the week-delta reports
    # nothing until there are two corrected rows — the same guard that stopped
    # the v1/v2 change from reading as a swing in world opinion.
    #
    # From v4 the row's index is the DAY's: articles first seen that date. The
    # per-country summaries stay on the seven-day cache — a single day is far
    # too thin per country — and feed only the map.
    #
    # Every day still inside the cache is recomputed, not just today: the cache
    # holds all of their articles, so once the rescore queue has converted a
    # day its row can honestly move to v4. A day not yet converted keeps its
    # old row untouched.
    kept = [a for rows in by_country.values() for a in rows]
    today_key = previous.get("lastUpdated") or today
    by_date = {r.get("date"): r for r in history}
    days = sorted({(a.get("firstSeen") or a.get("date")) for a in kept} | {today_key})
    for day in days:
        stats = day_stats(kept, day)
        if day == today_key:
            by_date[day] = {
                "date": day,
                "overallIndex": stats["index"] if stats else None,
                "totalArticles": stats["n"] if stats else 0,
                "sourceCount": stats["sourceCount"] if stats else 0,
                "stanceVersion": STANCE_VERSION,
                "day": stats,
                "countries": {
                    country: {**summary, "stanceVersion": STANCE_VERSION}
                    for country, summary in summaries.items()
                },
                "headlines": (by_date.get(day) or {}).get("headlines")
                or (history[-1].get("headlines") if history else []) or [],
            }
        elif stats is not None:
            old = by_date.get(day) or {"date": day, "countries": {}, "headlines": []}
            by_date[day] = {
                **old,
                # The old per-country summaries were computed under the previous
                # definition and cannot be redone for a past day, so they go:
                # left in place under a v4 stamp, anything comparing countries
                # across rows would subtract one definition from the other.
                "countries": {},
                "overallIndex": stats["index"],
                "totalArticles": stats["n"],
                "sourceCount": stats["sourceCount"],
                "stanceVersion": STANCE_VERSION,
                "day": stats,
            }
    history = sorted(by_date.values(), key=lambda r: r.get("date", ""))
    row = by_date[today_key]
    print("history row     : " + str(row["date"]) + " -> day index " + str(row["overallIndex"])
          + ", " + str(row["totalArticles"]) + " articles, v" + str(STANCE_VERSION))
    converted = [r["date"] for r in history if r.get("stanceVersion") == STANCE_VERSION]
    print("v" + str(STANCE_VERSION) + " days        : " + ", ".join(converted[-8:]))

    if dry:
        print("\n--dry: nothing written.")
        return 0

    OUTLETS_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    LEDGER_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    HISTORY_PATH.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nwrote {OUTLETS_PATH.name}, {LEDGER_PATH.name} and {HISTORY_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
