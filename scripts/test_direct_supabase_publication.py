import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SUPPORT = ROOT / "scripts" / "codex_automation_support.py"


def load_support():
    spec = importlib.util.spec_from_file_location("codex_automation_support", SUPPORT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def article(index: int) -> dict:
    paragraph = " ".join(["Lajmi"] * 100)
    return {
        "id": f"direct-article-{index}",
        "slug": f"artikulli-drejteperdrejte-{index:02d}",
        "url": f"https://Example{index}.test/story/?utm_source=feed#section",
        "dispatch": str(index),
        "title": f"Titulli i publikimit te drejtperdrejte {index}",
        "excerpt": "Permbledhje e artikullit testues.",
        "body": "\n\n".join([paragraph] * 5),
        "source": f"Source {index}",
        "source_flag": "🌍",
        "source_bias": "neutral",
        "tone": "neutral",
        "category": "Botë",
        "published_at": "2026-07-10T12:00:00+02:00",
        "reading_time": 3,
        "featured": False,
        "engagement_score": 7.0,
        "score_reason": "Lajm i verifikuar me interes per Kosoven.",
        "score_breakdown": {
            "relevance": 7, "urgency": 7, "public_impact": 7, "local_depth": 7,
            "controversy_interest": 7, "credibility": 7, "corroboration": 7, "editorial_safety": 7,
        },
        "score_formula": "test",
        "image_url": f"https://images.example/{index}.jpg",
        "image_width": 1400,
        "image_height": 800,
        "created_at": "2026-07-10T12:00:00+02:00",
    }


class DirectSupabasePublicationTests(unittest.TestCase):
    def setUp(self):
        self.support = load_support()
        self.articles = [article(index) for index in range(1, 14)]
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "2026-07-10T12.json"
        self.path.write_text(json.dumps(self.articles), encoding="utf-8")
        self.old_fetch = self.support._fetch_image_dimensions
        self.old_load_env = self.support.load_env
        self.old_env = {key: os.environ.get(key) for key in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")}
        self.support._fetch_image_dimensions = lambda _: (1400, 800)
        self.support.load_env = lambda: []
        os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://project.supabase.co"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test-key"

    def tearDown(self):
        self.directory.cleanup()
        self.support._fetch_image_dimensions = self.old_fetch
        self.support.load_env = self.old_load_env
        for key, value in self.old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_dedupe_rejects_canonical_url_and_material_headline_without_writes(self):
        calls = []

        def fake_request(method, table, **kwargs):
            calls.append((method, table, kwargs))
            self.assertEqual(method, "GET")
            self.assertEqual(table, "news_articles")
            return [{
                "id": "existing-id", "slug": "existing-slug", "url": "https://example1.test/story",
                "title": "Titulli i publikimit te drejtperdrejte 2", "batch_key": "older-batch",
            }]

        self.support._supabase_request = fake_request
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(self.support.dedupe_published(self.path), 1)
        self.assertIn("canonical URL", output.getvalue())
        self.assertIn("materially matches published headline", output.getvalue())
        self.assertTrue(all(method == "GET" for method, _, _ in calls))

    def test_validation_rejects_more_than_twenty_two_articles_before_any_request(self):
        self.path.write_text(json.dumps([article(index) for index in range(1, 24)]), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "cap each run at 22"):
            self.support.validate_batch(self.path)

    def test_publish_inserts_exact_mapping_and_verifies_readback(self):
        calls = []

        def fake_request(method, table, **kwargs):
            calls.append((method, table, kwargs))
            query = kwargs.get("query") or {}
            if method == "GET" and table == "news_articles" and not query.get("batch_key"):
                return []
            if method == "GET" and table == "news_batches":
                return []
            if method == "POST" and table == "news_batches":
                return []
            if method == "POST" and table == "news_articles":
                payload = kwargs["payload"]
                self.assertEqual(len(payload), 13)
                self.assertEqual(payload[0]["raw_article"], self.articles[0])
                self.assertEqual(payload[0]["batch_key"], "2026-07-10T12")
                self.assertEqual(payload[0]["source_flag"], "🌍")
                return []
            if method == "GET" and table == "news_articles" and query.get("batch_key") == "eq.2026-07-10T12":
                return [{"id": item["id"], "slug": item["slug"]} for item in self.articles]
            raise AssertionError(f"unexpected request: {method} {table} {kwargs}")

        self.support._supabase_request = fake_request
        self.assertEqual(self.support.publish_supabase(self.path), 0)
        self.assertEqual([call[:2] for call in calls], [
            ("GET", "news_articles"), ("GET", "news_batches"), ("POST", "news_batches"),
            ("POST", "news_articles"), ("GET", "news_articles"),
        ])

    def test_publish_cleans_up_new_batch_after_article_write_failure(self):
        calls = []

        def fake_request(method, table, **kwargs):
            calls.append((method, table, kwargs))
            if method == "GET":
                return []
            if method == "POST" and table == "news_batches":
                return []
            if method == "POST" and table == "news_articles":
                raise RuntimeError("mock article insert failure")
            if method == "DELETE" and table == "news_batches":
                self.assertEqual(kwargs["query"], {"batch_key": "eq.2026-07-10T12"})
                return []
            raise AssertionError(f"unexpected request: {method} {table} {kwargs}")

        self.support._supabase_request = fake_request
        self.assertEqual(self.support.publish_supabase(self.path), 1)
        self.assertIn(("DELETE", "news_batches"), [call[:2] for call in calls])

    def test_finalize_supabase_never_uses_git_or_deploy_hook(self):
        calls = []
        self.support.dedupe_published = lambda path: calls.append("dedupe") or 0
        self.support.publish_supabase = lambda path: calls.append("publish") or 0
        self.support.send_report = lambda path: calls.append("email") or 0
        self.support.verify_public_site = lambda path: calls.append("verify") or 0
        self.support.git_publish = lambda path: (_ for _ in ()).throw(AssertionError("legacy git publish called"))
        self.support.post_vercel_hook = lambda: (_ for _ in ()).throw(AssertionError("deploy hook called"))

        self.assertEqual(self.support.finalize_supabase(self.path), 0)
        self.assertEqual(calls, ["dedupe", "publish", "email", "verify"])


if __name__ == "__main__":
    unittest.main()
