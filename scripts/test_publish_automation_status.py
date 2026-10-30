import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('publisher', root / 'scripts/publish-automation-status.py')
publisher = importlib.util.module_from_spec(spec)
with patch.dict(os.environ, {'L383_REPO': str(root)}):
    spec.loader.exec_module(publisher)


class StatusTests(unittest.TestCase):
    def test_private_storage_override_avoids_public_edge_filter(self):
        env = {'AUTOMATION_STATUS_SUPABASE_URL': 'http://supabase-envoy:8000/',
               'NEXT_PUBLIC_SUPABASE_URL': 'https://public.example'}
        self.assertEqual(publisher.storage_base(env), 'http://supabase-envoy:8000/storage/v1')

    def test_public_storage_is_used_only_without_an_override(self):
        self.assertEqual(publisher.storage_base({'NEXT_PUBLIC_SUPABASE_URL': 'https://public.example/'}),
                         'https://public.example/storage/v1')


if __name__ == '__main__':
    unittest.main()
