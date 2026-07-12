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
        article.update(
            {
                "social_platform": social_platform,
                "social_post_account": "@source",
                "social_post_url": f"https://{social_platform}.example/post/{index}",
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
    support._fetch_image_dimensions = lambda _: (1400, 800)
    try:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-07-10T12.json"
            path.write_text(json.dumps(articles), encoding="utf-8")
            assert len(support.validate_batch(path)) == 20
            assert source_mix.validate(path) == 0

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


if __name__ == "__main__":
    test_strict_batch_validation()
    test_status_report_uses_gmail_fallback()
    print("codex automation support checks passed")
