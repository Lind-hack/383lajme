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

    def test_short_grounded_showbiz_format_does_not_relax_other_categories(self):
        body='<p>'+'Fakt i konfirmuar me hollësi të reja. '*8+'</p>'
        self.assertEqual(journalism_errors({'category':'Showbiz','body':body*2}),[])
        self.assertTrue(journalism_errors({'category':'Sport','body':body*2}))
        self.assertEqual(journalism_errors({'category':'Showbiz','body':body}),[])
        self.assertTrue(journalism_errors({'category':'Showbiz','body':'<p>'+('Fakt i ri. '*8)+'</p>'}))

if __name__=='__main__':unittest.main()
