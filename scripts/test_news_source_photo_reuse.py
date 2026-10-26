import copy
import unittest
from unittest.mock import patch

import news_image_policy as policy
import news_photo_editor as editor
from test_news_image_policy import page, plan


class SourcePhotoReuseTests(unittest.TestCase):
    def test_licensed_source_photo_is_retained_only_for_international_desks(self):
        photo = policy.candidate_photo(page('CC BY 4.0'), plan())
        option = {'tier': 'older', 'page': page('CC BY 4.0'), 'photo': photo}
        for category in ('Sport', 'Teknologji', 'Ekonomi', 'Botë', 'Showbiz', 'Kosovë', 'Shqipëri', ''):
            lead = {'category': category, '_source_urls': [photo['image_url']],
                    '_source_fingerprints': [(1600, 900, 'bytes', 123)]}
            with self.subTest(category=category), patch.object(policy, 'photo_fingerprint', return_value=(1600, 900, 'bytes', 123)):
                result = policy.finalize_photo(lead, option)
            if category in ('Kosovë', 'Shqipëri', ''):
                self.assertEqual(result, {})
            else:
                self.assertTrue(result)
                self.assertFalse(result['image_rights']['distinct_from_source'])
                self.assertTrue(result['image_rights']['source_image_reuse'])
                with patch.object(policy, 'trusted_photo', return_value=result):
                    self.assertEqual(policy.image_errors({**lead, **result}), [])
                    self.assertTrue(policy.image_errors({**lead, **result, 'category': 'Kosovë'}))

    def test_source_match_is_not_removed_before_the_visual_editor_sees_it(self):
        commons = page('CC BY-SA 4.0')
        original = commons['imageinfo'][0]['url']
        for category in ('Teknologji', 'Kosovë'):
            lead = {'category': category, 'title': 'Apple Park', 'photo_plan': plan()}
            with patch.object(policy, '_research', return_value=([original], [], [commons])):
                options = policy.photo_options(lead, {}, {}, 'older')
            self.assertEqual(len(options), 0 if category == 'Kosovë' else 1)
            if options:
                self.assertTrue(options[0]['source_image_match'])

    def test_reuse_does_not_waive_rights_batch_uniqueness_or_native_pixel_review(self):
        photo = policy.candidate_photo(page(), plan())
        option = {'tier': 'older', 'page': page(), 'photo': photo}
        lead = {'category': 'Teknologji', '_source_urls': [photo['image_url']],
                '_source_fingerprints': [(1600, 900, 'bytes', 123)]}
        with patch.object(policy, 'photo_fingerprint', return_value=(1600, 900, 'bytes', 123)):
            self.assertEqual(policy.finalize_photo({**lead, '_reserve_photo': lambda _: False}, option), {})
            with patch.dict(policy.os.environ, {'L383_HOURLY_NEWS': '1'}):
                self.assertEqual(policy.finalize_photo(lead, option), {})
            for key, value in (('license', 'CC BY-NC 4.0'), ('license_url', 'https://example.com/claim'),
                               ('provider', 'publisher'), ('creator', '')):
                changed = copy.deepcopy(option)
                changed['photo']['image_rights'][key] = value
                self.assertEqual(policy.finalize_photo(lead, changed), {}, key)
            changed = copy.deepcopy(option)
            changed['photo']['image_url'] = changed['photo']['image_url'].replace('https:', 'http:')
            self.assertEqual(policy.finalize_photo(lead, changed), {})

    def test_source_option_is_visible_before_the_per_tier_limit_and_labelled_for_review(self):
        photo = policy.candidate_photo(page(), plan())
        other = {'tier': 'older', 'page': page(), 'photo': photo}
        original = {**other, 'source_image_match': True}
        selected = editor.trimmed([other]*4+[original])
        self.assertIs(selected[0], original)
        self.assertEqual(len(selected), editor.MAX_OPTIONS['older'])
        self.assertIn('rights-cleared source article image', editor.describe(original))

    def test_exact_commons_source_file_is_fetched_even_when_subject_search_misses_it(self):
        original = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Apple_Park.jpg/900px-Apple_Park.jpg'
        for category in ('Teknologji', 'Kosovë'):
            lead = {'category': category, '_source_fingerprints': []}
            with patch.object(policy, 'commons_files', return_value=[{**page(), 'lead_image': True}]) as fetch:
                result = policy._research(lead, {'image_url': original}, {}, {**plan(), 'queries': []}, float('inf'))
            if category == 'Kosovë':
                fetch.assert_not_called()
            else:
                fetch.assert_called_once_with(['Apple_Park.jpg'])
                self.assertFalse(result[2][0]['lead_image'])
        for url in ('https://publisher.example/Apple_Park.jpg',
                    'https://upload.wikimedia.org/wikipedia/en/a/ab/Photo.jpg',
                    'http://upload.wikimedia.org/wikipedia/commons/a/ab/Photo.jpg',
                    'https://[invalid/Photo.jpg'):
            with patch.object(policy, 'commons_files') as fetch:
                policy._research({'category': 'Teknologji', '_source_fingerprints': []},
                                 {'image_url': url}, {}, {**plan(), 'queries': []}, float('inf'))
            fetch.assert_not_called()


if __name__ == '__main__':
    unittest.main()
