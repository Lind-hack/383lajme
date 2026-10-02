"""Offline checks for the all-market odds email and its durable send marker."""

import importlib.util
import sys
import tempfile
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('tregu_odds_digest', HERE / 'send-tregu-odds-digest.py')
digest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(digest)


class DigestTests(unittest.TestCase):
    def test_aggregates_every_recorded_move_without_inventing_one(self):
        rows = [
            {'market_id': 'one', 'created_at': '2026-10-02T10:00:00Z', 'market_prob': .55, 'market_prob_before': .5, 'oracle_kind': 'news_oracle'},
            {'market_id': 'one', 'created_at': '2026-10-02T11:00:00Z', 'market_prob': .53, 'oracle_kind': 'trade'},
            {'market_id': 'two', 'created_at': '2026-10-02T11:00:00Z', 'market_prob': .3, 'oracle_kind': 'sport_oracle'},
        ]
        items = digest.group_movements(rows)
        self.assertEqual(len(items), 2)
        one = next(item for item in items if item['market_id'] == 'one')
        self.assertEqual((one['before'], one['after'], one['changes']), (.5, .53, 2))
        self.assertEqual(next(item for item in items if item['market_id'] == 'two')['changes'], 0)

    def test_one_email_contains_every_changed_market_and_inline_graph(self):
        items = [
            {'market_id': 'one', 'market': {'question': 'Will it happen?', 'slug': 'one'},
             'before': .5, 'after': .55, 'low': .5, 'high': .55, 'changes': 1,
             'last_at': '2026-10-02T10:00:00Z', 'last_kind': 'news_oracle',
             'points': [('2026-10-02T09:00:00Z', .5), ('2026-10-02T10:00:00Z', .55)],
             'detail': {'oracle_reasoning': 'Two publishers confirmed it.', 'evidence': [{'title': 'Report', 'url': 'https://example.com/news'}]}},
            {'market_id': 'two', 'market': {'question': 'Who wins?', 'slug': 'two'},
             'before': .4, 'after': .3, 'low': .3, 'high': .4, 'changes': 2,
             'last_at': '2026-10-02T11:00:00Z', 'last_kind': 'sport_oracle',
             'points': [('2026-10-02T09:00:00Z', .4), ('2026-10-02T11:00:00Z', .3)],
             'detail': {}},
        ]
        with patch.dict(digest.os.environ, {'GMAIL_USER': 'sender@example.com'}):
            message = digest.build_message(items, datetime(2026, 10, 1, tzinfo=timezone.utc),
                                           datetime(2026, 10, 2, tzinfo=timezone.utc),
                                           lambda *args: b'\x89PNG\r\n\x1a\n')
        self.assertEqual(message['To'], digest.RECIPIENT)
        plain = message.get_body(preferencelist=('plain',)).get_content()
        self.assertIn('+5.00 percentage points', plain)
        self.assertIn('-10.00 percentage points', plain)
        self.assertIn('Two publishers confirmed it.', plain)
        self.assertEqual(sum(part.get_content_type() == 'image/png' for part in message.walk()), 2)

    def test_dry_run_and_smtp_failure_do_not_advance_marker(self):
        now = datetime(2026, 10, 2, 12, tzinfo=timezone.utc)
        item = digest.group_movements([{'market_id': 'one', 'created_at': now.isoformat(),
                                        'market_prob': .55, 'market_prob_before': .5, 'oracle_kind': 'news_oracle'}])
        item[0]['market'] = {'question': 'Will it happen?', 'slug': 'one'}
        item[0]['detail'] = {}
        module = types.SimpleNamespace(load_env=lambda: None)
        with tempfile.TemporaryDirectory() as directory, patch.dict(sys.modules, {'codex_automation_support': module}), \
             patch.dict(digest.os.environ, {'NEXT_PUBLIC_SUPABASE_URL': 'https://example.supabase.co',
                                           'SUPABASE_SERVICE_ROLE_KEY': 'test', 'GMAIL_USER': 'sender@example.com',
                                           'GMAIL_APP_PASSWORD': 'test'}), \
             patch.object(digest, 'snapshots_in_window', return_value=[]), \
             patch.object(digest, 'group_movements', return_value=item), \
             patch.object(digest, 'decorate', return_value=item), \
             patch.object(digest, 'get_rows', return_value=[]), \
             patch.object(digest, 'build_message', return_value=MagicMock()), \
             patch.object(digest.smtplib, 'SMTP_SSL') as smtp:
            marker = Path(directory) / 'last-sent-end'
            digest.main(now=now, state=Path(directory), dry_run=True)
            self.assertFalse(marker.exists())
            smtp.return_value.__enter__.return_value.send_message.side_effect = OSError('mail failed')
            with self.assertRaises(OSError):
                digest.main(now=now, state=Path(directory))
            self.assertFalse(marker.exists())
            smtp.return_value.__enter__.return_value.send_message.side_effect = None
            smtp.return_value.__enter__.return_value.send_message.return_value = {}
            digest.main(now=now, state=Path(directory))
            self.assertEqual(marker.read_text(), now.isoformat())


if __name__ == '__main__':
    unittest.main()
