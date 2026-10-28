import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

from isolate_valid_news_candidates import isolate


class PhotoIsolationTests(unittest.TestCase):
    def test_photo_alias_holds_only_the_later_draft_without_poisoning_other_photos(self):
        rows = [{'id':str(i), 'slug':f'photo-story-{i}', 'url':f'https://source.example/{i}',
                 'image_url':f'https://images.example/{i}.jpg',
                 'image_rights':{'sha256':digest}} for i,digest in ((1,'a'*64),(2,'a'*64),(3,'b'*64))]
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder)/'2026-10-28T17.json'
            batch.write_text(json.dumps(rows), encoding='utf-8')
            self.assertEqual(isolate(batch, validator=Mock()), 0)
            self.assertEqual(json.loads(batch.read_text(encoding='utf-8')), [rows[0],rows[2]])

    def test_invalid_first_draft_does_not_reserve_its_photo_against_a_valid_draft(self):
        rows = [{'id':str(i), 'slug':f'photo-story-{i}', 'url':f'https://source.example/{i}',
                 'image_url':f'https://images.example/{i}.jpg',
                 'image_rights':{'sha256':'a'*64}} for i in (1,2)]
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder)/'2026-10-28T17.json'
            batch.write_text(json.dumps(rows), encoding='utf-8')
            validator = Mock(side_effect=[ValueError('Unsupported claim'), None])
            self.assertEqual(isolate(batch, validator=validator), 0)
            self.assertEqual(json.loads(batch.read_text(encoding='utf-8')), [rows[1]])


if __name__ == '__main__':
    unittest.main()
