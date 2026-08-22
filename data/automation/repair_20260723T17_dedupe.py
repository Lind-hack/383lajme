#!/usr/bin/env python3
"""Replace three historical duplicates with current, direct-publisher leads."""
from __future__ import annotations

import importlib.util
import json
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BATCH = ROOT / "data" / "auto-articles" / "2026-07-23T17.json"
BUILDER = ROOT / "data" / "automation" / "build_20260723T17_direct.py"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

spec = importlib.util.spec_from_file_location("direct_builder", BUILDER)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

REPLACEMENTS = {
    "383-20260723T17-03": {
        "url": "https://www.footballtransfers.com/en/transfer-news/uk-premier-league/2026/07/chelsea-close-in-70m-maxence-lacroix-transfer-solves-two-xabi-alonso-biggest-problems-axel-disasi",
        "source": "FootballTransfers",
        "source_flag": "⚽",
        "category": "Sport",
        "title": "Chelsea lidhet me një transferim prej 70 milionë eurosh",
        "excerpt": "Raportimi thotë se Chelsea po afrohet me një transferim prej 70 milionë eurosh, të lidhur me planet e trajnerit Xabi Alonso.",
        "fact": "Raportimi e lidh Chelsean me një transferim prej 70 milionë eurosh që synon të adresojë dy probleme të përmendura te planet e Xabi Alonso.",
        "image_url": "https://static.footballtransfers.com/images/cf/image/upload/8ba39f24-2ee5-4d88-def2-de6c068cef00/q=75,w=1200,format=auto",
    },
    "383-20260723T17-05": {
        "url": "https://techcrunch.com/2026/07/23/ai-chip-startup-etched-defies-skeptics-hits-10-3b-valuation-from-big-name-investors/",
        "source": "TechCrunch",
        "source_flag": "🤖",
        "category": "Teknologji",
        "title": "Startupi Etched arrin vlerësim prej 10,3 miliardë dollarësh",
        "excerpt": "Startup-i i çipave Etched ka arritur një vlerësim prej 10,3 miliardë dollarësh pas investimeve nga emra të njohur, sipas raportimit.",
        "fact": "Etched, një startup i çipave, ka arritur vlerësim prej 10,3 miliardë dollarësh pas investimeve nga emra të njohur dhe thotë se çipat e tij synojnë të përshpejtojnë inferencën e modeleve.",
        "image_url": "https://techcrunch.com/wp-content/uploads/2026/07/Etched-co-founder-COO-Robert-Wachen.jpg?resize=1200,1200",
    },
    "383-20260723T17-12": {
        "url": "https://www.france24.com/en/after-meeting-with-moscow-washington-reiterates-wish-to-mediate-ukraine-war",
        "source": "France 24",
        "source_flag": "🌍",
        "category": "Botë",
        "title": "Uashingtoni përsërit synimin për ndërmjetësim në luftën e Ukrainës",
        "excerpt": "Pas takimit të ministrave të jashtëm amerikan dhe rus, Uashingtoni tha se dëshiron të ringjallë përpjekjet për ndërmjetësim, pa rezultate konkrete deri tani.",
        "fact": "Uashingtoni tha se dëshiron të ringjallë përpjekjet për ndërmjetësim pas takimit të ministrave të jashtëm amerikan dhe rus, pa rezultate konkrete deri tani.",
        "image_url": "https://s.france24.com/media/display/b3f3e75a-86a6-11f1-9e80-005056bfb2b6/w:1280/p:16x9/2026-07-23T042259Z-439737230-RC2GJMAOM4HL-RTRMADP-3-ASEAN-PHILIPPINES.jpg",
    },
}


def dimensions(url: str) -> tuple[int, int]:
    request = Request(url, headers={"User-Agent": UA})
    with urlopen(request, timeout=30) as response:
        content = response.read(15_000_000)
    with Image.open(BytesIO(content)) as image:
        image.verify()
    with Image.open(BytesIO(content)) as image:
        return image.size


def main() -> int:
    articles = json.loads(BATCH.read_text(encoding="utf-8"))
    by_id = {article["id"]: article for article in articles}
    if set(by_id) != {article["id"] for article in articles}:
        raise RuntimeError("duplicate article IDs")
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for identifier, data in REPLACEMENTS.items():
        article = by_id[identifier]
        width, height = dimensions(data["image_url"])
        if width < 1200 or height < 675:
            raise RuntimeError(f"undersized replacement image for {identifier}: {width}x{height}")
        article.update({
            "slug": module.slugify(data["title"]),
            "url": data["url"],
            "source": data["source"],
            "source_flag": data["source_flag"],
            "category": data["category"],
            "title": data["title"],
            "excerpt": data["excerpt"],
            "body": module.article_body(data["title"], data["fact"], data["source"], data["category"]),
            "image_url": data["image_url"],
            "image_width": width,
            "image_height": height,
            "created_at": now,
            "score_reason": "Burim i drejtpërdrejtë aktual, URL dhe imazh të verifikuar; kërkimi social përdoret vetëm për zbulim dhe jo si provë publikimi.",
        })
    if len({item["slug"] for item in articles}) != len(articles):
        raise RuntimeError("duplicate slugs after repair")
    BATCH.write_text(json.dumps(articles, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"REPAIRED {BATCH}: {len(REPLACEMENTS)} historical duplicates replaced")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
