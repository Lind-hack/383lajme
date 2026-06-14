import importlib.util
import json
import os
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "scripts" / "kosovo_pipeline.py"


def load_pipeline():
    spec = importlib.util.spec_from_file_location("kosovo_pipeline", PIPELINE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_google_ai_api_key1_env_name_is_supported():
    old_main = os.environ.get("GOOGLE_AI_API_KEY")
    old_key1 = os.environ.get("GOOGLE_AI_API_KEY1")
    old_alias = os.environ.get("GOOGLE_API_KEY1")
    try:
        os.environ["GOOGLE_AI_API_KEY"] = ""
        os.environ["GOOGLE_AI_API_KEY1"] = "new-key"
        os.environ["GOOGLE_API_KEY1"] = ""
        kp = load_pipeline()
    finally:
        for name, value in {
            "GOOGLE_AI_API_KEY": old_main,
            "GOOGLE_AI_API_KEY1": old_key1,
            "GOOGLE_API_KEY1": old_alias,
        }.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    fallback_providers = [p for p in kp.LLM_PROVIDERS if p.get("key_label") == "key1"]
    assert fallback_providers
    assert all(p["key"] == "new-key" for p in fallback_providers)


def test_json_parsing_and_title_cleanup(kp):
    parsed = kp._parse_json('```json\n{"title":"Test", "score": 8,}\n```')
    assert parsed["score"] == 8

    cleaned = kp.clean_generated_title("Kurti takohet me NATO-n -- ja pse kjo ka rendesi")
    assert cleaned == "Kurti takohet me NATO-n"


def test_mock_analyze_cleans_clickbait_title(kp):
    body = " ".join(
        ["Kosova dhe qytetarët kanë nevojë për informacion të saktë për këtë lajm."] * 10
    )

    def fake_gemma(messages, max_tokens=1024, temperature=0.3):
        return json.dumps(
            {
                "score": 8.1,
                "breakdown": {
                    "relevance": 8,
                    "urgency": 8,
                    "interest": 8,
                    "credibility": 9,
                },
                "featured": False,
                "category": "Politikë",
                "breaking": False,
                "reason": "Reuters është burim kredibil dhe lajmi prek Kosovën drejtpërdrejt.",
                "title": "Kurti takohet me NATO-n -- ja pse kjo ka rëndësi",
                "excerpt": "Kosova diskutoi sigurinë me NATO-n. Kjo prek qytetarët në veri.",
                "body": body,
                "tone": "neutral",
                "source_bias": "neutral",
            },
            ensure_ascii=False,
        )

    old = kp._gemma
    kp._gemma = fake_gemma
    try:
        result = kp.analyze_and_translate(
            "Original title",
            "Summary",
            source="Reuters",
            article_text="Source details",
        )
    finally:
        kp._gemma = old

    assert result is not None
    assert "ja pse" not in result["title"].lower()
    assert result["title"] == "Kurti takohet me NATO-n"


def test_article_native_image_and_text_extraction(kp):
    class FakeResp:
        status_code = 200
        text = """<html><head>
          <meta property="og:image" content="/media/article-main.webp">
          <script type="application/ld+json">{"image":{"url":"https://example.com/ld.jpg"}}</script>
        </head><body><article>
          <p>This is a long paragraph from the source article with enough words to be included in extraction.</p>
          <img src="/inside-story.jpg" width="900" height="500">
        </article></body></html>"""

    def fake_get(url, *args, **kwargs):
        return FakeResp()

    old_get = kp.requests.get
    kp.requests.get = fake_get
    try:
        assert kp.resolve_article_url("https://example.com/news/story") == "https://example.com/news/story"
        assert (
            kp._article_native_images("https://example.com/news/story", set())[0]
            == "https://example.com/media/article-main.webp"
        )
        assert "source article" in kp.fetch_article_text("https://example.com/news/story")
    finally:
        kp.requests.get = old_get


def test_google_provider_success_path(kp):
    calls = []

    def fake_google(llm, prompt, max_tokens, temperature):
        calls.append(llm["provider"])
        return '{"title":"Titull i saktë","score":8}'

    old_google = kp._call_google_ai
    old_providers = kp.LLM_PROVIDERS
    kp._call_google_ai = fake_google
    kp.LLM_PROVIDERS = [
        {"provider": "Google Gemma", "kind": "google", "model": "gemma-4-26b-a4b-it", "key": "x", "url": "x"},
    ]
    try:
        text = kp._gemma([{"role": "user", "content": "Return JSON"}])
    finally:
        kp._call_google_ai = old_google
        kp.LLM_PROVIDERS = old_providers

    assert "Titull i saktë" in text
    assert calls == ["Google Gemma"]


def test_google_api_key1_fallback_after_main_quota(kp):
    calls = []

    def fake_google(llm, prompt, max_tokens, temperature):
        calls.append(f"{llm.get('key_label')}:{llm['model']}")
        if llm.get("key_label") == "main":
            raise RuntimeError("HTTP 429: RESOURCE_EXHAUSTED monthly spending cap")
        return '{"title":"Titull nga key1","score":8}'

    old_google = kp._call_google_ai
    old_providers = kp.LLM_PROVIDERS
    kp._call_google_ai = fake_google
    kp.LLM_PROVIDERS = [
        {"provider": "Google Gemma", "kind": "google", "model": "gemma-main", "key": "old", "key_label": "main", "url": "x"},
        {"provider": "Google Gemma", "kind": "google", "model": "gemma-main-backup", "key": "old", "key_label": "main", "url": "x"},
        {"provider": "Google Gemma", "kind": "google", "model": "gemma-main", "key": "new", "key_label": "key1", "url": "x"},
    ]
    try:
        text = kp._gemma([{"role": "user", "content": "Return JSON"}])
    finally:
        kp._call_google_ai = old_google
        kp.LLM_PROVIDERS = old_providers

    assert "Titull nga key1" in text
    assert calls == ["main:gemma-main", "key1:gemma-main"]


def test_fatal_google_error_stops_retries(kp):
    def fake_gemma(messages, max_tokens=1024, temperature=0.3):
        raise RuntimeError("HTTP 429: RESOURCE_EXHAUSTED monthly spending cap")

    old = kp._gemma
    kp._gemma = fake_gemma
    try:
        try:
            kp.analyze_and_translate("Title", "Summary", source="Reuters", article_text="Facts")
        except kp.FatalLLMProviderError as exc:
            assert "Fatal Google Gemma provider error" in str(exc)
        else:
            raise AssertionError("fatal provider error did not stop retries")
    finally:
        kp._gemma = old


def test_main_soft_exits_on_fatal_google_error(kp):
    old_fetch = kp.fetch_candidates
    old_seen = kp.load_existing_urls
    old_covered = kp.build_covered_set
    old_diversify = kp.diversify_candidates
    old_fetch_text = kp.fetch_article_text
    old_analyze = kp.analyze_and_translate
    old_output_dir = kp.OUTPUT_DIR

    kp.load_existing_urls = lambda: set()
    kp.build_covered_set = lambda: []
    kp.diversify_candidates = lambda candidates: candidates
    kp.fetch_article_text = lambda url: "Facts"
    kp.fetch_candidates = lambda seen: [
        {
            "url": "https://example.com/story",
            "source": "Reuters",
            "source_flag": "🌍",
            "source_bias": "neutral",
            "lane": "Kosovo",
            "title_en": "Kosovo PM meets NATO officials",
            "summary": "Security talks in Brussels.",
            "raw_image": None,
            "published_at": None,
        }
    ]

    def fatal(*args, **kwargs):
        raise kp.FatalLLMProviderError("Fatal Google Gemma provider error")

    kp.analyze_and_translate = fatal
    with tempfile.TemporaryDirectory() as tmpdir:
        kp.OUTPUT_DIR = Path(tmpdir)
        try:
            assert kp.main() is None
        finally:
            kp.fetch_candidates = old_fetch
            kp.load_existing_urls = old_seen
            kp.build_covered_set = old_covered
            kp.diversify_candidates = old_diversify
            kp.fetch_article_text = old_fetch_text
            kp.analyze_and_translate = old_analyze
            kp.OUTPUT_DIR = old_output_dir


def main():
    test_google_ai_api_key1_env_name_is_supported()
    kp = load_pipeline()
    test_json_parsing_and_title_cleanup(kp)
    test_mock_analyze_cleans_clickbait_title(kp)
    test_article_native_image_and_text_extraction(kp)
    test_google_provider_success_path(kp)
    test_google_api_key1_fallback_after_main_quota(kp)
    test_fatal_google_error_stops_retries(kp)
    test_main_soft_exits_on_fatal_google_error(kp)
    print("kosovo pipeline regression checks passed")


if __name__ == "__main__":
    main()
