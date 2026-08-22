#!/usr/bin/env python3
"""Editorial verification helper: fetch URL, print title/og:image/main text."""
import sys, re, html
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en,sq;q=0.9"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def main(url):
    raw = fetch(url)
    def meta(prop):
        m = re.search(r'<meta[^>]+(?:property|name)=["\']' + re.escape(prop) + r'["\'][^>]+content=["\']([^"\']+)', raw) \
            or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + re.escape(prop) + r'["\']', raw)
        return html.unescape(m.group(1)) if m else None
    t = re.search(r"<title[^>]*>(.*?)</title>", raw, re.S)
    print("TITLE:", html.unescape(t.group(1)).strip() if t else None)
    print("OG:TITLE:", meta("og:title"))
    print("OG:IMAGE:", meta("og:image"))
    for m in re.finditer(r'<meta[^>]+property=["\']og:image:width["\'][^>]+content=["\']([^"\']+)', raw):
        print("OG:IMAGE:WIDTH:", m.group(1))
    for m in re.finditer(r'<meta[^>]+property=["\']og:image:height["\'][^>]+content=["\']([^"\']+)', raw):
        print("OG:IMAGE:HEIGHT:", m.group(1))
    body = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", body))
    text = re.sub(r"\n{2,}", "\n", re.sub(r"[ \t]{2,}", " ", text))
    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 60]
    print("---TEXT---")
    print("\n".join(lines[:60])[:6000])

if __name__ == "__main__":
    main(sys.argv[1])
