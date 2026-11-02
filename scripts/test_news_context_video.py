import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from bs4 import BeautifulSoup
import news_context_video as clips
from read_news_source import extract


class ContextVideoTests(unittest.TestCase):
    def test_preparation_keeps_original_photo_with_source_bound_context_clip(self):
        from prepare_editor_sources import ready_image
        photo={'image_url':'https://publisher.example/original.jpg','image_rights':{'provider':'publisher-article'}}
        lead={'category':'Showbiz','_visual_options':[{'tier':'article'}]}
        clip={'url':'https://www.youtube.com/watch?v=abcdefghijk','source_page':'https://privebruto.com/performance'}
        with patch.dict('os.environ',{'L383_HOURLY_NEWS':'1'}), \
                patch('news_image_policy.finalize_photo',return_value=photo),patch.object(clips,'prepare_clip',return_value=clip):
            prepared=ready_image(lead,{}, {})
        self.assertEqual(prepared['image_url'],'https://publisher.example/original.jpg')
        self.assertEqual(prepared['video_clip_url'],clip['url'])
        self.assertEqual(prepared['image_rights']['context_video'],clip)

    def test_only_public_youtube_article_links_are_candidates(self):
        raw='''<article><div class="entry-content"><p>Rita Ora performs the new song on stage with her band in London.</p>
        <iframe data-src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>
        <a href="https://youtu.be/abcdefghijk?t=20">Clip</a>
        <aside><iframe src="https://youtube.com/embed/related1234"></iframe></aside>
        <div class="related-post"><a href="https://youtu.be/other123456">Other story</a></div>
        </div></article><footer><a href="https://youtu.be/footer12345">Footer</a></footer>'''
        evidence=extract(raw,'https://privebruto.com/rita-performance')
        self.assertEqual(evidence['video_candidates'],['https://www.youtube.com/watch?v=abcdefghijk'])
        for url in ['https://youtube.com.evil.test/watch?v=abcdefghijk','http://youtu.be/abcdefghijk',
                    'https://evil@youtube.com/watch?v=abcdefghijk','https://youtube.com:444/watch?v=abcdefghijk',
                    'https://youtube.com/watch?v=bad']:
            self.assertIsNone(clips.watch_url(url))

    def test_only_source_bound_positive_event_review_attaches_clip(self):
        lead={'category':'Showbiz','title':'Rita Ora performs her new song','url':'https://privebruto.com/rita-performance'}
        primary={'status':'text_extracted','text':'Rita Ora performed the new song in London.',
                 'video_candidates':['https://youtu.be/abcdefghijk']}
        poster=io.BytesIO();Image.new('RGB',(480,360)).save(poster,format='JPEG')
        response=SimpleNamespace(raise_for_status=lambda:None,json=lambda:{'type':'video','title':'Rita Ora - London performance','author_name':'Rita Ora'})
        with tempfile.TemporaryDirectory() as folder,patch.object(clips,'Path',side_effect=lambda p:Path(folder)/p), \
                patch.object(clips.requests,'get',return_value=response), \
                patch('read_news_source.fetch_public',return_value={'payload':poster.getvalue()}), \
                patch('news_model.ask_rows',return_value=[{'url':'https://www.youtube.com/watch?v=abcdefghijk','relevant':True,'reason':'Exact London performance in the article.'}]) as review:
            selected=clips.prepare_clip(lead,primary)
            self.assertEqual(selected['url'],'https://www.youtube.com/watch?v=abcdefghijk')
            self.assertIn('not_video_stream',selected['review_scope'])
            self.assertTrue(review.call_args.kwargs['image_path'].is_file())
            from news_showbiz_focus import ARTISTS
            artist=next(a for a in ARTISTS if a['id']=='rita-ora')
            artist_lead={**lead,'artist_research':{'official_posts':[{'artist':'rita-ora','platform':'YouTube',
                'author_status':'official_channel_feed','author_channel_id':artist['youtube_channel_id'],
                'url':'https://youtu.be/abcdefghijk'}]}}
            official=clips.prepare_clip(artist_lead,{**primary,'video_candidates':[]})
            self.assertTrue(official['basis'].startswith('verified_artist_channel_feed'))
            artist_lead['artist_research']['official_posts'][0]['author_channel_id']='UCsomeoneelse'
            self.assertIsNone(clips.prepare_clip(artist_lead,{**primary,'video_candidates':[]}))
            review.return_value=[{'url':'https://www.youtube.com/watch?v=other123456','relevant':True,'reason':'Same artist'}]
            self.assertIsNone(clips.prepare_clip(lead,primary))
            review.return_value=[{'url':'https://www.youtube.com/watch?v=abcdefghijk','relevant':False,'reason':'Different song'}]
            self.assertIsNone(clips.prepare_clip(lead,primary))

    def test_absent_or_blocked_clips_do_not_invent_a_video(self):
        lead={'category':'Showbiz','url':'https://privebruto.com/story'}
        self.assertIsNone(clips.prepare_clip(lead,{'status':'text_extracted'}))
        with patch.object(clips.requests,'get',side_effect=clips.requests.RequestException('blocked')):
            self.assertIsNone(clips.prepare_clip(lead,{'status':'text_extracted','video_candidates':['https://youtu.be/abcdefghijk']}))


if __name__=='__main__':unittest.main()
