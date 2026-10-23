import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import news_photo_identity_cache as cache
import news_image_policy as policy


class PhotoIdentityCacheTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / "identities.json"
        env = patch.dict(os.environ, {"L383_PHOTO_IDENTITY_CACHE": str(self.path)})
        env.start()
        self.addCleanup(env.stop)
        cache._path, cache._entries = None, {}
        policy._wiki_search.cache_clear()
        policy._identity_claims.cache_clear()
        self.addCleanup(policy._wiki_search.cache_clear)
        self.addCleanup(policy._identity_claims.cache_clear)

    def reload(self):
        cache._path, cache._entries = None, {}
        policy._wiki_search.cache_clear()
        policy._identity_claims.cache_clear()

    def test_fresh_wiki_and_identity_results_survive_a_new_preparation_process(self):
        page = {"title": "Prishtina", "pageprops": {"wikibase_item": "Q25270"},
                "terms": {"description": ["capital of Kosovo"]}}
        responses = [{"query": {"pages": {"1": page}}}, {"claims": {"P625": [{"mainsnak": {}}]}}]
        with patch.object(policy, "api_get", side_effect=[SimpleNamespace(json=lambda data=data: data) for data in responses]) as request:
            self.assertEqual(policy._wiki_search("en", "Prishtina"), (page,))
            self.assertTrue(policy._identity_claims("Q25270", "P625"))
        self.assertEqual(request.call_count, 2)
        cache.save()
        self.reload()
        with patch.object(policy, "api_get", side_effect=AssertionError("fresh identity must not be fetched again")):
            self.assertEqual(policy._wiki_search("en", "Prishtina"), (page,))
            self.assertTrue(policy._identity_claims("Q25270", "P625"))
        self.assertFalse(policy.wiki_identity_allowed(page, "Prishtina", "A different unrelated place", "Kosovë", set(), require_photo=False))
        self.assertEqual(len(json.loads(self.path.read_text(encoding="utf-8"))["entries"]), 2)

    def test_expired_future_malformed_and_wrong_version_records_are_misses(self):
        for stamp in (time.time() - cache.TTL - 5, time.time() + 600, "yesterday"):
            self.path.write_text(json.dumps({"version": 1, "entries": {"test": {"fetched_at": stamp, "value": [1]}}}), encoding="utf-8")
            self.reload()
            self.assertIsNone(cache.get("test"))
        for text in ('broken JSON', '{"version":0,"entries":{}}', '[]'):
            self.path.write_text(text, encoding="utf-8")
            self.reload()
            self.assertIsNone(cache.get("test"))

    def test_lookup_errors_and_empty_searches_are_never_saved_as_identity_success(self):
        with patch.object(policy, "api_get", side_effect=policy.requests.Timeout("deadline")):
            with self.assertRaises(policy.requests.Timeout):
                policy._wiki_search("en", "Prishtina")
        with patch.object(policy, "api_get", return_value=SimpleNamespace(json=lambda: {"error": {"code": "busy"}})):
            with self.assertRaises(ValueError):
                policy._identity_claims("Q25270", "P625")
        with patch.object(policy, "api_get", return_value=SimpleNamespace(json=lambda: {"query": {"pages": {}}})):
            self.assertEqual(policy._wiki_search("en", "No result"), ())
        cache.save()
        self.assertEqual(json.loads(self.path.read_text(encoding="utf-8"))["entries"], {})

    def test_saved_cache_is_bounded_and_failed_writes_leave_current_results_usable(self):
        for index in range(4):
            cache.remember(f"entity-{index}", {"entity": index})
        with patch.object(cache, "LIMIT", 2):
            cache.save()
        self.assertEqual(len(json.loads(self.path.read_text(encoding="utf-8"))["entries"]), 2)
        with patch.object(cache.os, "replace", side_effect=OSError("disk unavailable")):
            cache.save()
        self.assertEqual(cache.get("entity-3"), {"entity": 3})


if __name__ == "__main__":
    unittest.main()
