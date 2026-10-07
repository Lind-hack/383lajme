import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import codex_automation_support as support


class NewsCacheRefreshTests(unittest.TestCase):
    def test_exact_article_and_desk_paths_and_partial_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            batch = Path(directory) / "batch.json"
            batch.write_text(json.dumps([{"slug": "bitcoin-test", "category": "Ekonomi"}, {"slug": "local-test", "category": "Kosovë"}]), encoding="utf-8")
            expected = ["/", "/toni", "/per-ty", "/article/bitcoin-test", "/article/local-test", "/kategori/ekonomi", "/kategori/kosove"]
            def respond(request, timeout):
                self.assertEqual(json.loads(request.data), {"paths": expected})
                self.assertEqual(request.full_url, "https://383ks.com/api/revalidate")
                self.assertEqual(request.get_header("Authorization"), "Bearer test-secret")
                return io.BytesIO(json.dumps({"revalidated": expected, "failed": []}).encode())
            with patch.object(support, "load_env"), patch.dict(os.environ, {"SITE_URL": "https://www.383ks.com", "TREGU_AUTOMATION_SECRET": "test-secret"}), patch.object(support.urllib.request, "urlopen", side_effect=respond):
                self.assertEqual(support.refresh_news_pages(batch), 0)
            with patch.object(support, "load_env"), patch.dict(os.environ, {"SITE_URL": "https://www.383ks.com", "TREGU_AUTOMATION_SECRET": "test-secret"}), patch.object(support.urllib.request, "urlopen", return_value=io.BytesIO(b'{"revalidated": ["/"], "failed": []}')):
                self.assertEqual(support.refresh_news_pages(batch), 1)

    def test_secret_is_not_sent_to_another_host(self):
        with tempfile.TemporaryDirectory() as directory:
            batch = Path(directory) / "batch.json"
            batch.write_text('[{"slug":"test","category":"Ekonomi"}]')
            with patch.object(support, "load_env"), patch.dict(os.environ, {"SITE_URL": "https://example.com", "TREGU_AUTOMATION_SECRET": "test-secret"}), patch.object(support.urllib.request, "urlopen") as request:
                self.assertEqual(support.refresh_news_pages(batch), 1)
                request.assert_not_called()

    def test_twenty_articles_refresh_all_paths_in_bounded_requests(self):
        from news_source_policy import CATEGORIES
        with tempfile.TemporaryDirectory() as directory:
            batch = Path(directory) / "batch.json"
            rows = [{"slug": f"story-{i}", "category": CATEGORIES[i % 7]} for i in range(20)]
            batch.write_text(json.dumps(rows), encoding="utf-8")
            seen = []
            def respond(request, timeout):
                paths = json.loads(request.data)["paths"]
                self.assertLessEqual(len(paths), 20)
                seen.extend(paths)
                return io.BytesIO(json.dumps({"revalidated": paths, "failed": []}).encode())
            with patch.object(support, "load_env"), patch.dict(os.environ, {"SITE_URL": "https://383ks.com", "TREGU_AUTOMATION_SECRET": "test-secret"}), patch.object(support.urllib.request, "urlopen", side_effect=respond) as request:
                self.assertEqual(support.refresh_news_pages(batch), 0)
                self.assertEqual(request.call_count, 2)
            self.assertEqual(len(seen), 30)
            self.assertTrue(all(f"/article/story-{i}" in seen for i in range(20)))

    def test_second_refresh_request_failure_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            batch = Path(directory) / "batch.json"
            batch.write_text(json.dumps([{"slug": f"story-{i}", "category": "Ekonomi"} for i in range(20)]), encoding="utf-8")
            def respond(request, timeout):
                paths = json.loads(request.data)["paths"]
                if "/kategori/ekonomi" in paths:
                    return io.BytesIO(b'{"failed":[{"path":"/kategori/ekonomi"}],"revalidated":[]}')
                return io.BytesIO(json.dumps({"revalidated": paths, "failed": []}).encode())
            with patch.object(support, "load_env"), patch.dict(os.environ, {"SITE_URL": "https://383ks.com", "TREGU_AUTOMATION_SECRET": "test-secret"}), patch.object(support.urllib.request, "urlopen", side_effect=respond):
                self.assertEqual(support.refresh_news_pages(batch), 1)


if __name__ == "__main__":
    unittest.main()
