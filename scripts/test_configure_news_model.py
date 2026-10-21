import tempfile
import unittest
from pathlib import Path

import yaml

from configure_news_model import configure


class IsolatedNewsConfigurationTests(unittest.TestCase):
    def test_luna_max_has_room_to_reason_without_changing_other_models(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder) / 'news-pipeline-hermes'
            home.mkdir()
            path = home / 'config.yaml'
            original = {'agent': {'other_setting': True}, 'fallback_model': {'provider': 'other-provider', 'model': 'other-model'}, 'providers': {
                'openai-codex': {'models': {'other-model': {'stale_timeout_seconds': 45}}}}}
            path.write_text(yaml.safe_dump(original), encoding='utf-8')
            configure(home)
            actual = yaml.safe_load(path.read_text(encoding='utf-8'))
            self.assertEqual(actual['agent'], {'other_setting': True, 'reasoning_effort': 'max'})
            self.assertIsNone(actual['fallback_model'])
            models = actual['providers']['openai-codex']['models']
            self.assertEqual(models['other-model'], {'stale_timeout_seconds': 45})
            self.assertEqual(models['gpt-6-luna']['stale_timeout_seconds'], 600)
            self.assertEqual(models['gpt-6-luna']['timeout_seconds'], 900)

    def test_explicit_longer_model_timeouts_are_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder) / 'news-pipeline-hermes'
            home.mkdir()
            path = home / 'config.yaml'
            original = {'providers': {'openai-codex': {'models': {'gpt-6-luna': {
                'stale_timeout_seconds': 1000, 'timeout_seconds': 1100}}}}}
            path.write_text(yaml.safe_dump(original), encoding='utf-8')
            configure(home)
            model = yaml.safe_load(path.read_text())['providers']['openai-codex']['models']['gpt-6-luna']
            self.assertEqual(model['stale_timeout_seconds'], 1000)
            self.assertEqual(model['timeout_seconds'], 1100)

    def test_shared_hermes_home_cannot_be_modified(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder) / 'shared-home'
            home.mkdir()
            path = home / 'config.yaml'
            path.write_text('agent: {}\n', encoding='utf-8')
            with self.assertRaises(ValueError):
                configure(home)
            self.assertEqual(path.read_text(), 'agent: {}\n')


if __name__ == '__main__':
    unittest.main()
