import os
import re
import json
import requests
from bs4 import BeautifulSoup

GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

GENERATE_PROMPT = """You are a Kosovo news journalist writing in Albanian (Shqip) for 383 Lajme.

Original article (English):
Title: {title}
Summary: {summary}

Produce a JSON object with EXACTLY these 6 keys:
- title: compelling Albanian headline (max 15 words)
- excerpt: 2-3 sentence Albanian lead paragraph
- body: full Albanian article, 4-5 paragraphs, ~250-350 words, journalistic style
- category: EXACTLY one of [Politikë, Ekonomi, Siguri, Sport, Teknologji, Kulturë, Shoqëri, Diasporë]
- tone: EXACTLY one of [positive, neutral, negative]
- source_bias: EXACTLY one of [neutral, pro-kosovo, critical]

Return ONLY the JSON object. No markdown, no code blocks, no explanation."""


def _strip_thinking(text: str) -> str:
    # Gemma 4 wraps its reasoning in <thought>...</thought> — strip it before parsing
    return re.sub(r"<thought>.*?</thought>", "", text, flags=re.DOTALL).strip()


def get_wikimedia_image(query: str) -> str | None:
    """Search Wikimedia Commons for a relevant photo. Free, no API key needed."""
    try:
        r = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 6,
                "format": "json",
                "srlimit": 5,
            },
            timeout=10,
        )
        results = r.json().get("query", {}).get("search", [])
        image_titles = [
            item["title"] for item in results
            if any(item["title"].lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png"))
        ]
        if not image_titles:
            return None
        r2 = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "titles": image_titles[0],
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": 800,
                "format": "json",
            },
            timeout=10,
        )
        pages = r2.json().get("query", {}).get("pages", {})
        for page in pages.values():
            infos = page.get("imageinfo", [])
            if infos:
                return infos[0].get("thumburl") or infos[0].get("url")
        return None
    except Exception:
        return None


def scrape_image(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        return None
    except Exception:
        return None


def generate_article(title: str, summary: str) -> dict:
    resp = requests.post(
        GOOGLE_AI_URL,
        headers={
            "Authorization": f"Bearer {os.environ['GOOGLE_AI_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gemma-4-31b-it",
            "messages": [
                {
                    "role": "user",
                    "content": GENERATE_PROMPT.format(title=title, summary=summary[:800]),
                }
            ],
            "max_tokens": 4096,
        },
        timeout=120,
    )
    resp.raise_for_status()
    text = _strip_thinking(resp.json()["choices"][0]["message"]["content"])
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
