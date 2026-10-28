"""Compare persisted news against the exact reviewed records, by article ID."""
from datetime import datetime, timezone
from html.parser import HTMLParser
import re
from urllib.parse import parse_qs, urlsplit


def _plain(text):
    # Match lib/article-body.mjs's intentionally limited decoder exactly.
    text = re.sub(r"<[^>]*>", " ", str(text))
    for pattern, value in ((r"&nbsp;", " "), (r"&amp;", "&"), (r"&quot;", '"'),
                           (r"&#0*39;|&apos;", "'"), (r"&lt;", "<"), (r"&gt;", ">"),
                           (r"&hellip;", "…"), (r"&mdash;", "—"), (r"&ndash;", "–")):
        text = re.sub(pattern, value, text, flags=re.I)
    return " ".join(text.split())


class _StoryHTML(HTMLParser):
    """Read visible story elements, excluding script data and related cards."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.capture, self.chunks = [], None, []
        self.title, self.category, self.paragraphs, self.images, self.videos = "", "", [], [], []
        self.body_depth, self.body_found, self.body_paragraphs = None, False, []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        active = bool(self.stack)
        if tag == "article" and "article-story" in attrs.get("class", "").split():
            active = True
        if not active:
            return
        if tag == "img":
            # The first figure is the article hero, before related cards.
            if "figure" in self.stack:
                source = attrs.get("src", "")
                if urlsplit(source).path == "/_next/image":
                    source = parse_qs(urlsplit(source).query).get("url", [source])[0]
                self.images.append(source)
        if tag == "iframe" and "figure" in self.stack:
            self.videos.append(attrs.get("src", ""))
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(tag)
        # Current ArticleContent's body container; keep the entire paragraph
        # list separate from the excerpt, reader questions and comments.
        style = re.sub(r"\s", "", attrs.get("style", ""))
        if tag == "div" and "font-size:17px" in style and "line-height:1.85" in style:
            self.body_depth, self.body_found = len(self.stack), True
        if tag in {"h1", "p"} or (tag == "a" and not self.category and attrs.get("href", "").startswith("/kategori/")):
            self.capture, self.chunks = tag, []

    def handle_data(self, data):
        if self.capture and not any(tag in self.stack for tag in ("script", "style", "noscript")):
            self.chunks.append(data)

    def handle_endtag(self, tag):
        if not self.stack:
            return
        if tag == self.capture:
            text = " ".join("".join(self.chunks).split())
            if tag == "h1":
                self.title = text
            elif tag == "p":
                self.paragraphs.append(text)
                if self.body_depth is not None:
                    self.body_paragraphs.append(text)
            elif tag == "a":
                self.category = text
            self.capture, self.chunks = None, []
        if tag in self.stack:
            if self.body_depth == len(self.stack):
                self.body_depth = None
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]


def verify_html(article: dict, html: str) -> None:
    story = _StoryHTML()
    story.feed(html)
    body = str(article.get("body") or "")
    html_body = re.search(r"</?(?:p|div|br|h[1-6]|ul|ol|li|blockquote)\b", body, flags=re.I)
    separator = r"</(?:p|div|h[1-6]|li|blockquote)>|<br\s*/?>" if html_body else r"\n{2,}"
    paragraphs = [_plain(part) for part in re.split(separator, body, flags=re.I) if _plain(part)]
    video = re.fullmatch(r"https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})", str(article.get("video_clip_url") or ""))
    visual_matches = (bool(story.videos) and story.videos[0] == f"https://www.youtube-nocookie.com/embed/{video[1]}") if video else (
        bool(story.images) and story.images[0] == article["image_url"])
    if (story.title != " ".join(article["title"].split()) or story.category != article["category"]
            or story.paragraphs[:1] != [" ".join(str(article.get("excerpt") or "").split())]
            or not story.body_found or story.body_paragraphs != paragraphs
            or not visual_matches):
        raise RuntimeError(f"public article content/category/photo mismatch: {article['slug']}")


def _timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def verify_rows(expected: list[dict], persisted: list[dict], batch_key: str) -> None:
    wanted = {str(row['id']): row for row in expected}
    actual = {str(row.get('id', '')): row for row in persisted}
    if len(wanted) != len(expected) or len(actual) != len(persisted) or set(actual) != set(wanted):
        raise RuntimeError(f'SUPABASE readback identity/count mismatch for batch {batch_key!r}')
    for key, row in wanted.items():
        saved = actual[key]
        for field, value in row.items():
            matches = field in saved and saved[field] == value
            if field in {'published_at', 'created_at'}:
                matches = _timestamp(value) is not None and _timestamp(value) == _timestamp(saved.get(field))
            elif field == 'raw_article':
                # A legacy retry's local file may lack extra database review
                # metadata. Every field actually supplied must still match.
                matches = isinstance(saved.get(field), dict) and all(
                    name in saved[field] and saved[field][name] == item for name, item in value.items())
            if not matches:
                raise RuntimeError(f'SUPABASE readback mismatch for batch {batch_key!r}, article {key!r}, field {field!r}')


def verify_live(batch, site="https://383ks.com"):
    import concurrent.futures
    import json
    import time
    from urllib.parse import quote
    from urllib.request import Request, urlopen
    articles = json.loads(batch.read_text(encoding="utf-8"))
    def check(article):
        url = f"{site}/article/{quote(article['slug'], safe='')}?verify={time.time_ns()}"
        request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "383-publication-readback/1.0"})
        with urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError(f"public article returned HTTP {response.status}: {article['slug']}")
            verify_html(article, response.read().decode("utf-8"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(check, articles))
    print(f"383 LIVE READBACK: exact headline, category, excerpt, body and hero photo/video verified for {len(articles)} articles")


if __name__ == "__main__":
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, type=Path)
    args = parser.parse_args()
    verify_live(args.file)
