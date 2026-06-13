import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PIPELINE = ROOT / "scripts" / "kosovo_pipeline.py"


def load_pipeline():
    spec = importlib.util.spec_from_file_location("kosovo_pipeline", PIPELINE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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


def test_provider_fallback_after_google_failure(kp):
    calls = []

    def fake_google(llm, prompt, max_tokens, temperature):
        calls.append(llm["provider"])
        raise RuntimeError("HTTP 429: RESOURCE_EXHAUSTED")

    def fake_groq(llm, prompt, max_tokens, temperature):
        calls.append(llm["provider"])
        return '{"title":"Titull i saktë","score":8}'

    old_google = kp._call_google_ai
    old_groq = kp._call_groq_ai
    old_providers = kp.LLM_PROVIDERS
    kp._call_google_ai = fake_google
    kp._call_groq_ai = fake_groq
    kp.LLM_PROVIDERS = [
        {"provider": "Google AI", "kind": "google", "model": "gemini-2.5-flash", "key": "x", "url": "x"},
        {"provider": "Groq", "kind": "groq", "model": "llama-3.3-70b-versatile", "key": "x", "url": "x"},
    ]
    try:
        text = kp._gemma([{"role": "user", "content": "Return JSON"}])
    finally:
        kp._call_google_ai = old_google
        kp._call_groq_ai = old_groq
        kp.LLM_PROVIDERS = old_providers

    assert "Titull i saktë" in text
    assert calls == ["Google AI", "Groq"]


def main():
    kp = load_pipeline()
    test_json_parsing_and_title_cleanup(kp)
    test_mock_analyze_cleans_clickbait_title(kp)
    test_article_native_image_and_text_extraction(kp)
    test_provider_fallback_after_google_failure(kp)
    print("kosovo pipeline regression checks passed")


if __name__ == "__main__":
    main()
