import importlib.util
import json
import os
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SUPPORT = ROOT / "scripts" / "codex_automation_support.py"
SOURCE_MIX = ROOT / "scripts" / "validate_source_mix.py"


def load_support():
    spec = importlib.util.spec_from_file_location("codex_automation_support", SUPPORT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    # This legacy suite isolates structure, images and social metadata using
    # synthetic publishers. Real source/category enforcement is exercised by
    # test_news_source_policy.py and the direct-publication integration tests.
    module.article_source_errors = lambda article: []
    module.source_policy_error = lambda category, source, url: None
    return module


def load_source_mix():
    spec = importlib.util.spec_from_file_location("validate_source_mix", SOURCE_MIX)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def make_article(index: int, category: str, social_platform: str = "") -> dict:
    paragraph = " ".join(["Lajmi"] * 100)
    body = "\n\n".join([paragraph] * 5)
    article = {
        "id": f"article-{index}",
        "slug": f"artikulli-testues-{index:02d}",
        "url": f"https://source{index}.example/story",
        "dispatch": str(index),
        "title": f"Titulli i artikullit testues {index}",
        "excerpt": "Permbledhje e artikullit testues.",
        "body": body,
        "source": f"Source {index}",
        "source_flag": "",
        "source_bias": "neutral",
        "tone": "neutral",
        "category": category,
        "city": None,
        "corroborating_sources": [{"source": "Independent source", "url": f"https://confirm{index}.example/story"}],
        "published_at": "2026-07-10T12:00:00+02:00",
        "reading_time": 3,
        "featured": False,
        "engagement_score": 7.0,
        "score_reason": "Lajm i verifikuar me interes per Kosoven.",
        "score_breakdown": {
            "relevance": 7,
            "urgency": 7,
            "public_impact": 7,
            "local_depth": 7,
            "controversy_interest": 7,
            "credibility": 7,
            "corroboration": 7,
            "editorial_safety": 7,
        },
        "score_formula": "test",
        "image_url": f"https://images.example/{index}.jpg",
        "image_width": 1400,
        "image_height": 800,
        "created_at": "2026-07-10T12:00:00+02:00",
    }
    if social_platform:
        article["url"] = f"https://{social_platform.lower().replace('/', '-')}.example/post/{index}"
        article.update(
            {
                "social_platform": social_platform,
                "social_post_account": "@source",
                "social_post_url": article["url"],
                "social_post_basis": "Postimi u perdor si sinjal dhe u verifikua me burim kryesor.",
            }
        )
    return article


def test_strict_batch_validation():
    support = load_support()
    source_mix = load_source_mix()
    categories = sorted(support.VALID_CATEGORIES)
    articles = [
        make_article(index, categories[index % len(categories)], "X/Twitter" if index < 3 else "Instagram" if index < 9 else "")
        for index in range(1, 21)
    ]
    old_fetch = support._fetch_image_dimensions
    old_verify_social_post = support._verify_social_post
    support._fetch_image_dimensions = lambda _: (1400, 800)
    support._verify_social_post = lambda _: None
    try:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-07-10T12.json"
            path.write_text(json.dumps(articles), encoding="utf-8")
            assert len(support.validate_batch(path)) == 20
            assert source_mix.validate(path) == 0

            # Category ownership is covered against the real registry separately.
            social_fields = {key: articles[0][key] for key in ("social_platform", "social_post_account", "social_post_url", "social_post_basis")}
            articles[0]["social_post_account"] = "@FabrizioRomano"
            articles[0]["title"] = "FabrizioRomano sjell lajmin e transferimit"
            path.write_text(json.dumps(articles), encoding="utf-8")
            try:
                support.validate_batch(path)
            except ValueError as exc:
                assert "reader-facing title/excerpt mentions" in str(exc)
            else:
                raise AssertionError("source account leaked into reader-facing title")
            articles[0].update(social_fields)
            articles[0]["title"] = "Titulli i artikullit testues 1"
            path.write_text(json.dumps(articles), encoding="utf-8")

            articles[0]["engagement_score"] = 8.3
            articles[0]["reading_time"] = 1
            path.write_text(json.dumps(articles), encoding="utf-8")
            normalized = support.normalize_batch(path)
            assert normalized[0]["engagement_score"] == 7.0
            assert normalized[0]["reading_time"] == 3
            assert len(support.validate_batch(path)) == 20
            articles = normalized

            articles[0]["body"] = "Shume shkurt."
            articles[0]["reading_time"] = 1
            path.write_text(json.dumps(articles), encoding="utf-8")
            assert len(support.validate_batch(path)) == 20

            articles[8]["body"] = "Shume shkurt."
            articles[8]["reading_time"] = 1
            path.write_text(json.dumps(articles), encoding="utf-8")
            try:
                support.validate_batch(path)
            except ValueError as exc:
                assert "body is too short" in str(exc)
            else:
                raise AssertionError("short article passed strict validation")
    finally:
        support._fetch_image_dimensions = old_fetch
        support._verify_social_post = old_verify_social_post


def test_image_quality_floor_and_verified_source_fallback():
    support = load_support()
    article = make_article(1, "Kosovë")
    original_fetch = support._fetch_image_dimensions
    original_candidates = support._fetch_page_image_candidates
    dimensions = {
        article["image_url"]: (800, 450),
        "https://source1.example/also-small.jpg": (960, 540),
        "https://confirm1.example/full-size.jpg": (1600, 900),
    }
    try:
        support._fetch_image_dimensions = lambda url: dimensions[url]
        support._fetch_page_image_candidates = lambda page: (
            ["https://source1.example/also-small.jpg"]
            if page == article["url"]
            else ["https://confirm1.example/full-size.jpg"]
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-07-10T12.json"
            path.write_text(json.dumps([article]), encoding="utf-8")
            normalized = support.normalize_batch(path)
            assert len(normalized) == 1
            assert normalized[0]["image_url"] == "https://confirm1.example/full-size.jpg"
            assert normalized[0]["image_width"] == 1600
            assert normalized[0]["image_height"] == 900
    finally:
        support._fetch_image_dimensions = original_fetch
        support._fetch_page_image_candidates = original_candidates


def test_web_image_source_must_match_exact_story_and_not_be_an_image_site():
    support = load_support()
    article = make_article(1, "Sport")
    article["title"] = "Mbappé shënon dy herë për Real Madridin në Champions"
    article["excerpt"] = "Kylian Mbappé vendosi ndeshjen e Real Madridit në Ligën e Kampionëve."
    article["image_source_pages"] = [
        {"source": "International Sport", "url": "https://sport.example/mbappe-real-madrid-champions"},
        {"source": "Image search", "url": "https://images.google.com/search?q=mbappe"},
        {"source": "Stock", "url": "https://shutterstock.com/search/mbappe"},
    ]

    assert support._image_source_matches_story(
        article, "Kylian Mbappe scores twice as Real Madrid wins Champions League match"
    )
    assert not support._image_source_matches_story(
        article, "Real Madrid presents plans for renovated stadium"
    )
    assert support._internet_image_source_urls(article) == [
        "https://sport.example/mbappe-real-madrid-champions"
    ]


def test_matching_web_coverage_supplies_a_sharp_fallback():
    support = load_support()
    article = make_article(1, "Sport")
    article["title"] = "Mbappé shënon dy herë për Real Madridin në Champions"
    article["excerpt"] = "Kylian Mbappé vendosi ndeshjen e Real Madridit në Ligën e Kampionëve."
    article["image_source_pages"] = [
        {"source": "International Sport", "url": "https://sport.example/mbappe-real-madrid-champions"}
    ]
    original_fetch = support._fetch_image_dimensions
    original_candidates = support._fetch_page_image_candidates
    original_metadata = support._fetch_page_image_metadata
    try:
        support._fetch_image_dimensions = lambda url: (
            (800, 450) if url == article["image_url"] else (1600, 900)
        )
        support._fetch_page_image_candidates = lambda _page: []
        support._fetch_page_image_metadata = lambda _page: (
            "Kylian Mbappe scores twice as Real Madrid wins Champions League match",
            ["https://cdn.sport.example/mbappe-match.jpg"],
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-07-10T12.json"
            path.write_text(json.dumps([article]), encoding="utf-8")
            normalized = support.normalize_batch(path)
            assert len(normalized) == 1
            assert normalized[0]["image_url"] == "https://cdn.sport.example/mbappe-match.jpg"
            assert normalized[0]["image_width"] == 1600
            assert normalized[0]["image_height"] == 900
    finally:
        support._fetch_image_dimensions = original_fetch
        support._fetch_page_image_candidates = original_candidates
        support._fetch_page_image_metadata = original_metadata


def test_status_report_uses_gmail_fallback():
    support = load_support()
    original_env = {key: os.environ.get(key) for key in ("RESEND_API_KEY", "GMAIL_USER", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL", "CRON_SLOT_LABEL")}
    original_load_env = support.load_env
    original_resend = support._send_resend_report
    original_gmail = support._send_gmail_report
    original_clock = support._kosovo_time_label
    sent: dict[str, str] = {}
    try:
        os.environ.update(
            {
                "RESEND_API_KEY": "test-resend",
                "GMAIL_USER": "bot@example.com",
                "GMAIL_APP_PASSWORD": "test-password",
                "RECIPIENT_EMAIL": "reader@example.com",
                "CRON_SLOT_LABEL": "2026-07-10 13:00 Kosovo time",
            }
        )
        support.load_env = lambda: None
        support._kosovo_time_label = lambda: "2026-07-10 13:05 Kosovo time"
        support._send_resend_report = lambda *_: 1

        def fake_gmail(user, password, recipient, subject, report_html):
            sent.update({"user": user, "recipient": recipient, "subject": subject, "html": report_html})
            return 0

        support._send_gmail_report = fake_gmail
        assert support.send_status_report("Nuk u gjet lajm i verifikuar.") == 0
        assert sent["recipient"] == "reader@example.com"
        assert "pa artikuj" in sent["subject"]
        assert "Nuk u gjet lajm" in sent["html"]
    finally:
        support.load_env = original_load_env
        support._send_resend_report = original_resend
        support._send_gmail_report = original_gmail
        support._kosovo_time_label = original_clock
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_larger_image_rendition_only_swaps_for_measured_pixels():
    support = load_support()
    measured = {
        "https://ichef.bbci.co.uk/ace/standard/2048/cpsprodpb/4476/live/a.jpg": (2048, 1152),
        "https://telegrafi.com/media-library/image.jpg?id=67866712": (1620, 1080),
        "https://telegrafi.com/media-library/image.jpg?id=67866712&width=1620&height=810&coordinates=0%2C135%2C0%2C135": (1620, 810),
        "https://example.al/wp-content/uploads/2026/09/photo.jpg": (2400, 1600),
    }

    def fake_dimensions(url):
        if url not in measured:
            raise OSError("404")
        return measured[url]

    old_fetch = support._fetch_image_dimensions
    support._fetch_image_dimensions = fake_dimensions
    try:
        assert support._larger_image_rendition(
            "https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/4476/live/a.jpg", 1200
        ) == ("https://ichef.bbci.co.uk/ace/standard/2048/cpsprodpb/4476/live/a.jpg", 2048, 1152)
        # Telegrafi is re-rendered at the crop's native width, never upscaled past it.
        assert support._larger_image_rendition(
            "https://telegrafi.com/media-library/image.jpg?id=67866712&width=1200&height=600&coordinates=0%2C135%2C0%2C135", 1200
        ) == (
            "https://telegrafi.com/media-library/image.jpg?id=67866712&width=1620&height=810&coordinates=0%2C135%2C0%2C135",
            1620,
            810,
        )
        # A WordPress size falls back to its original; the -scaled guess 404s and is skipped.
        assert support._larger_image_rendition(
            "https://example.al/wp-content/uploads/2026/09/photo-1024x576.jpg", 1024
        ) == ("https://example.al/wp-content/uploads/2026/09/photo.jpg", 2400, 1600)
        # The uploaded file itself (-780x439-1.jpg) has no larger original to ask for.
        assert support._larger_image_candidates("https://example.al/wp-content/uploads/2026/09/p-780x439-1.jpg") == []
        # Nothing measurably larger means the stored URL stands.
        assert support._larger_image_rendition("https://www.balkanweb.com/wp-content/uploads/2026/09/640-0-x.jpg", 640) is None
        assert support._larger_image_rendition("https://ichef.bbci.co.uk/ace/standard/2048/cpsprodpb/4476/live/a.jpg", 2048) is None
    finally:
        support._fetch_image_dimensions = old_fetch


if __name__ == "__main__":
    test_strict_batch_validation()
    test_image_quality_floor_and_verified_source_fallback()
    test_web_image_source_must_match_exact_story_and_not_be_an_image_site()
    test_matching_web_coverage_supplies_a_sharp_fallback()
    test_status_report_uses_gmail_fallback()
    test_larger_image_rendition_only_swaps_for_measured_pixels()
    print("codex automation support checks passed")
