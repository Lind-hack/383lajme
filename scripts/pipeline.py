#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from slugify import slugify

load_dotenv(Path(__file__).parent / ".env")
sys.path.insert(0, str(Path(__file__).parent))

from database import (
    init_db,
    get_unprocessed,
    mark_skipped,
    save_processed,
    next_dispatch_number,
)
from rss_fetcher import fetch_all
from scorer import score_article
from content_generator import generate_article, scrape_image, get_wikimedia_image


def run():
    db_path = Path(__file__).parent.parent / "data" / "articles.db"
    print(f"[pipeline] DB: {db_path}")
    conn = init_db(db_path)

    print("[pipeline] Fetching RSS feeds...")
    fetch_all(conn)

    unprocessed = get_unprocessed(conn, limit=20)
    print(f"[pipeline] {len(unprocessed)} unprocessed articles")

    for row in unprocessed:
        title = row["title"] or ""
        raw = row["raw_content"] or ""
        url = row["url"] or ""
        article_id = row["id"]

        print(f"  Scoring: {title[:60]}")
        result = score_article(title, raw)
        score = result.get("score", 0)
        is_breaking = result.get("breaking", False)
        print(f"  Score: {score}  breaking={is_breaking}")

        if score < 7:
            mark_skipped(conn, article_id)
            continue

        try:
            fields = generate_article(title, raw)
        except Exception as e:
            print(f"  Generate error: {e}")
            mark_skipped(conn, article_id)
            continue

        # Placement: score>=9 or breaking → hero (featured=1)
        featured = 1 if (score >= 9 or is_breaking) else 0

        # Image priority: RSS feed image → og:image scrape → Wikimedia → picsum
        image_url = row["raw_image"] if row["raw_image"] else None
        if not image_url:
            image_url = scrape_image(url) if url else None
        # Skip Google-hosted thumbnails — they're tiny generic images
        if image_url and "lh3.googleusercontent.com" in image_url:
            image_url = None
        if not image_url:
            wiki_query = "Kosovo " + " ".join(title.split()[:4])
            image_url = get_wikimedia_image(wiki_query)
        if not image_url:
            seed = slugify(fields.get("title", title))[:30]
            image_url = f"https://picsum.photos/seed/{seed}/800/500"

        slug = slugify(fields.get("title", title))[:80]
        dispatch = next_dispatch_number(conn)
        body = fields.get("body", "")

        save_processed(
            conn,
            article_id,
            {
                "slug": slug,
                "dispatch": dispatch,
                "title": fields.get("title", title),
                "excerpt": fields.get("excerpt", ""),
                "body": body,
                "category": fields.get("category", "Shoqëri"),
                "tone": fields.get("tone", "neutral"),
                "source_bias": fields.get("source_bias", "neutral"),
                "reading_time": max(2, len(body.split()) // 200),
                "featured": featured,
                "engagement_score": score,
                "image_url": image_url,
            },
        )
        print(f"  Published: {slug}  (featured={featured}, score={score})")

    conn.close()
    print("[pipeline] Done.")


if __name__ == "__main__":
    run()
