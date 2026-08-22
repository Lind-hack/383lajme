import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent.parent
SUPPORT = ROOT / "scripts" / "codex_automation_support.py"


def load_support():
    spec = importlib.util.spec_from_file_location("codex_automation_support_http", SUPPORT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class SupabaseHttpTests(unittest.TestCase):
    def setUp(self):
        self.support = load_support()
        self.old_load_env = self.support.load_env
        self.old_env = {
            name: os.environ.get(name)
            for name in ("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
        }
        self.support.load_env = lambda: []
        os.environ["NEXT_PUBLIC_SUPABASE_URL"] = "https://project.supabase.co"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-test-key"

    def tearDown(self):
        self.support.load_env = self.old_load_env
        for name, value in self.old_env.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value

    def test_rest_request_uses_service_role_headers_and_never_contacts_network(self):
        seen = {}

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def read(self):
                return b'[{"id":"batch-1"}]'

        def fake_urlopen(request, timeout):
            seen["url"] = request.full_url
            seen["method"] = request.get_method()
            seen["headers"] = {name.lower(): value for name, value in request.header_items()}
            seen["payload"] = request.data
            seen["timeout"] = timeout
            return Response()

        with patch.object(self.support.urllib.request, "urlopen", fake_urlopen):
            result = self.support._supabase_request(
                "POST", "news_batches", payload={"batch_key": "batch-1"}
            )

        self.assertEqual(result, [{"id": "batch-1"}])
        self.assertEqual(seen["url"], "https://project.supabase.co/rest/v1/news_batches")
        self.assertEqual(seen["method"], "POST")
        self.assertEqual(seen["headers"]["apikey"], "service-role-test-key")
        self.assertEqual(seen["headers"]["authorization"], "Bearer service-role-test-key")
        self.assertEqual(seen["headers"]["prefer"], "return=minimal")
        self.assertEqual(json.loads(seen["payload"]), {"batch_key": "batch-1"})
        self.assertEqual(seen["timeout"], 30)


if __name__ == "__main__":
    unittest.main()
