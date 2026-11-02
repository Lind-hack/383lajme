import unittest
from unittest.mock import patch
from news_image_policy import article_photo_options,publisher_photo_allowed,finalize_photo
from journalism_quality_gate import journalism_errors
from codex_automation_support import image_minimum

class ShowbizPolicyTests(unittest.TestCase):
    def test_original_photo_is_bound_to_showbiz_article_without_fabricated_license(self):
        lead={'category':'Showbiz','url':'https://www.nme.com/news/music/artist-post','title':'A public artist update'}
        evidence={'status':'text_extracted','url':lead['url'],'image_url':'https://www.nme.com/wp-content/uploads/2026/11/artist.jpg'}
        options=article_photo_options(lead,evidence)
        self.assertTrue(options)
        photo=options[0]['photo']
        self.assertTrue(publisher_photo_allowed(lead,photo))
        self.assertEqual(photo['image_rights']['license'],'Not established')
        self.assertFalse(publisher_photo_allowed({**lead,'category':'Sport'},photo))
        self.assertFalse(publisher_photo_allowed({**lead,'url':lead['url']+'other'},photo))
        self.assertEqual(article_photo_options(lead,{**evidence,'url':'https://people.com/another-story'}),[])
        with patch('news_image_policy.photo_fingerprint',return_value=(800,450,'a'*64,1)):
            with patch.dict('os.environ',{'L383_HOURLY_NEWS':'0'}):
                result=finalize_photo(lead,options[0])
        self.assertTrue(result['image_rights']['source_image_reuse'])
        self.assertEqual(image_minimum({**lead,**photo}),(600,350))
        self.assertEqual(image_minimum({**lead,**photo,'category':'Sport'})[0],1200)

    def test_verified_small_source_image_is_restored_without_upgrading_or_refetching(self):
        import json,tempfile,os
        from pathlib import Path
        from datetime import datetime,timezone
        import news_image_policy as policy
        from codex_automation_support import normalize_batch
        lead={'category':'Showbiz','url':'https://kultplus.com/rita-update','title':'Rita Ora zbulon tatuazhin e ri',
              'slug':'rita-ora-tatuazh','body':'<p>Fakte të verifikuara.</p>','image_url':'https://kultplus.com/full.jpg'}
        option=article_photo_options(lead,{'status':'text_extracted','url':lead['url'],'image_url':'https://kultplus.com/photo-728x430.jpg'})[0]
        photo=option['photo'];photo.update(image_width=728,image_height=430)
        now=datetime.now(timezone.utc).isoformat()
        photo['image_rights'].update(verified_at=now,sha256='a'*64,visual_review={
            'policy':'383-native-photo-v1','provider':'openai-codex','model':'gpt-6-luna','effort':'max',
            'image_sha256':'a'*64,'contact_sheet_sha256':'b'*64,'reviewed_at':now})
        with tempfile.TemporaryDirectory() as folder,patch.object(policy,'CATALOG',Path(folder)/'catalog.json'),patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}):
            policy.CATALOG.write_text(json.dumps({lead['url']:photo}),encoding='utf-8')
            batch=Path(folder)/'2026-11-01T21.json';batch.write_text(json.dumps([lead]),encoding='utf-8')
            with patch(f'{normalize_batch.__module__}._fetch_image_dimensions',side_effect=AssertionError('already decoded')),patch(f'{normalize_batch.__module__}._larger_image_rendition',side_effect=AssertionError('invalidates native proof')):
                rows=normalize_batch(batch)
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['image_url'],photo['image_url'])
            self.assertEqual((rows[0]['image_width'],rows[0]['image_height']),(728,430))

    def test_artist_briefs_and_mobile_titles_are_not_rejected_as_non_entertainment(self):
        from news_source_policy import topic_error
        from editorial_rules_v2 import title_errors
        for title in ('Lily Allen me kostum për Halloween','Juan Atkins, pionieri i techno-s, vdes','Wu-Tang Clan do të performojë në pushimin e ndeshjes'):
            self.assertIsNone(topic_error('Showbiz',title),title)
        from news_source_policy import article_source_errors
        self.assertEqual(article_source_errors({'category':'Showbiz','url':'https://www.nme.com/news/music/juan-atkins','title':'Juan Atkins vdes në moshën 64-vjeçare','body':'<p>Qyteti do ta kujtojë muzikantin.</p>'}),[])
        self.assertIsNotNone(topic_error('Showbiz','Lions fiton ndeshjen 3-0'))
        self.assertIsNotNone(topic_error('Showbiz','Lions performance in football match wins 3-0'))
        title='Billie Eilish dhe Phoebe Bridgers shfaqen në filmin e ri të shkurtër'
        self.assertGreater(len(title),65)
        self.assertFalse(any('character' in e for e in title_errors({'category':'Showbiz','title':title})))
        self.assertTrue(any('character' in e for e in title_errors({'category':'Sport','title':title})))

    def test_independent_editor_receives_the_same_showbiz_format_exception(self):
        from pathlib import Path
        prompt=(Path(__file__).parent/'run-news-editor.sh').read_text(encoding='utf-8')
        self.assertIn('Retained Showbiz briefs need at least 50 grounded words in one HTML paragraph.',prompt)
        self.assertIn('Other categories need at least 140 grounded words in three HTML paragraphs.',prompt)
        self.assertIn('Prepared Showbiz publisher-article images need at least 600 by 350 decoded pixels',prompt)

    def test_hourly_schema_preserves_the_showbiz_source_image_exception(self):
        import json
        from pathlib import Path
        schema=json.loads((Path(__file__).parents[1]/'docs/news-output-schema.json').read_text(encoding='utf-8'))
        self.assertEqual((schema['properties']['image_width']['minimum'],schema['properties']['image_height']['minimum']),(600,350))
        rule=schema['allOf'][0]
        self.assertEqual(rule['if']['properties']['category']['const'],'Showbiz')
        self.assertEqual(rule['else']['properties']['image_width']['minimum'],1200)
        self.assertEqual(rule['else']['properties']['image_height']['minimum'],630)

    def test_short_grounded_showbiz_format_does_not_relax_other_categories(self):
        body='<p>'+'Fakt i konfirmuar me hollësi të reja. '*8+'</p>'
        self.assertEqual(journalism_errors({'category':'Showbiz','body':body*2}),[])
        self.assertTrue(journalism_errors({'category':'Sport','body':body*2}))
        self.assertEqual(journalism_errors({'category':'Showbiz','body':body}),[])
        self.assertTrue(journalism_errors({'category':'Showbiz','body':'<p>'+('Fakt i ri. '*8)+'</p>'}))

if __name__=='__main__':unittest.main()
