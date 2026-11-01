import hashlib
import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
from PIL import Image
from news_showbiz_article_visual import capture_article_photo

URL='https://www.nme.com/news/music/public-artist-update'
IMAGE='https://www.nme.com/wp-content/uploads/2026/11/artist.jpg'
PUB={'source':'NME','domains':['nme.com']}


class ArticleVisualTests(unittest.TestCase):
    def response(self,html,url=URL):return {'url':url,'payload':html.encode(),'headers':{}}

    def test_complete_public_text_and_actual_source_image_are_not_claimed_as_page_pixels(self):
        text='A verified artist public statement with supported details. '*500+'FINAL_SOURCE_FACT'
        html=f'<meta property="og:title" content="Public artist update"><meta property="og:image" content="{IMAGE}"><article><p>{text}</p></article>'
        payload=BytesIO();Image.new('RGB',(640,480),'blue').save(payload,format='JPEG');raw=payload.getvalue()
        image=Mock(return_value=raw)
        with tempfile.TemporaryDirectory() as folder:
            record=capture_article_photo(URL,PUB,folder,fetcher=lambda *a,**kw:self.response(html),image_fetcher=image)
            self.assertTrue(record['evidence']['text'].endswith('FINAL_SOURCE_FACT'))
            self.assertGreater(len(record['evidence']['text']),14000)
            self.assertTrue(record['complete_public_text'])
            self.assertFalse(record['article_text_visible'])
            self.assertFalse(record['visual_layout_complete'])
            self.assertFalse(record['visual_page_complete'])
            self.assertEqual(record['visual_evidence_kind'],'source_article_image')
            self.assertEqual(record['source_image_url'],IMAGE)
            self.assertEqual(record['source_image_sha256'],hashlib.sha256(raw).hexdigest())
            self.assertTrue(Path(record['screenshot']).is_file())
        image.assert_called_once_with(IMAGE)

    def test_restricted_source_is_not_reconstructed_from_hidden_content(self):
        schema=json.dumps({'@type':'NewsArticle','url':URL,'isAccessibleForFree':False})
        html=f'<script type="application/ld+json">{schema}</script><article><p>'+('Restricted text. '*100)+'</p></article>'
        image=Mock()
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError,'restricted'):
                capture_article_photo(URL,PUB,folder,fetcher=lambda *a,**kw:self.response(html),image_fetcher=image)
        image.assert_not_called()

    def test_fresh_public_body_is_reused_without_rewriting_its_fetch_time(self):
        from datetime import datetime,timezone
        checked=datetime.now(timezone.utc).isoformat()
        evidence={'url':URL,'status':'text_extracted','text':'Verified public statement. '*100,
                  'title':'Artist update','image_url':IMAGE,'fetched_at':checked}
        raw=BytesIO();Image.new('RGB',(640,480),'blue').save(raw,format='JPEG')
        fetcher=Mock(side_effect=AssertionError('fresh complete public body must not be fetched twice'))
        with tempfile.TemporaryDirectory() as folder:
            record=capture_article_photo(URL,PUB,folder,fetcher=fetcher,image_fetcher=lambda url:raw.getvalue(),public_evidence=evidence)
        self.assertEqual(record['evidence']['fetched_at'],checked)
        fetcher.assert_not_called()

    def test_redirect_outside_the_publisher_never_becomes_article_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError,'redirected'):
                capture_article_photo(URL,PUB,folder,fetcher=lambda *a,**kw:self.response('<article>Other</article>','https://people.com/another-story'))


if __name__=='__main__':unittest.main()
