"""One-off (2026-11-02): the social desk's first articles carried tall Instagram photos, and the
site's 16:9 / 16:10 / 3:2 frames cut the faces off. Rebuild each social article's image as the
whole photo in a 1600x900 frame (clip_scout.wide_photo) and point the article at it.
Run on the VPS in the clip scout's environment:  python fix_social_images.py"""
import json
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clip_scout as cs  # noqa: E402


def main() -> int:
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    base = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    req = urllib.request.Request(f"{base}/rest/v1/news_articles?select=id,slug,image_url,image_width,image_height,raw_article"
                                 "&id=like.social-*", headers={**cs.HEADERS, "apikey": key, "Authorization": f"Bearer {key}"})
    rows = json.loads(urllib.request.urlopen(req, timeout=60).read())
    print(f"{len(rows)} social articles")
    fixed = 0
    for r in rows:
        if r["image_width"] == 1600 and r["image_height"] == 900:
            print(f"  already wide: {r['slug']}")
            continue
        if (r.get("raw_article") or {}).get("image_rights", {}).get("provider") == "383-card":
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "src.jpg", Path(tmp) / "wide.jpg"
            stem = r["image_url"].split(f"/public/{cs.BUCKET}/", 1)[-1].rsplit(".", 1)[0]
            status, body = cs.storage("GET", f"object/{cs.BUCKET}/{stem}.jpg")
            if status != 200:
                print(f"  could not read {stem}.jpg: HTTP {status}")
                continue
            src.write_bytes(body)
            if not cs.wide_photo(src, out) or not cs.upload(f"{stem}-wide.jpg", out.read_bytes(), "image/jpeg"):
                print(f"  could not rebuild {r['slug']}")
                continue
        w, h = 1600, 900
        url = cs.public_url(f"{stem}-wide.jpg")
        raw = {**(r.get("raw_article") or {}), "image_url": url, "image_width": w, "image_height": h}
        status, reply = cs.rest("PATCH", "news_articles", {"image_url": url, "image_width": w, "image_height": h, "raw_article": raw},
                                f"?id=eq.{r['id']}")
        print(f"  {'fixed' if status in (200, 204) else f'PATCH failed HTTP {status} {reply[:120]!r}'}: {r['slug']}")
        fixed += status in (200, 204)
    print(f"{fixed} images rebuilt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
