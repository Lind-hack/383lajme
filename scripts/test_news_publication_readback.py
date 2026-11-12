import copy
import unittest

from news_publication_readback import verify_rows, verify_html
from html import escape
from urllib.parse import quote


def rows():
    return [{'id':str(i), 'slug':f'story-{i}', 'category':category, 'body':f'Own reporting {i}',
             'image_url':f'https://images.example/photo-{i}.jpg', 'image_width':1600, 'image_height':1000,
             'published_at':'2026-10-24T18:00:00+02:00',
             'raw_article':{'image_rights':{'creator':'Photographer','license':'CC BY 4.0'},
                            'image_subject':f'Subject {i}', 'image_caption':'Dated photo'}}
            for i,category in enumerate(('Sport','Ekonomi'),1)]


class PublicationReadbackTests(unittest.TestCase):
    def test_old_batch_readback_loads_persisted_enrichment_without_accepting_changed_copy(self):
        import tempfile,json,os
        from pathlib import Path
        from unittest.mock import patch
        from news_publication_readback import verify_live
        article=dict(rows()[0],title='Titulli',excerpt='Përmbledhja fillestare.',body='<p>Kopja e miratuar.</p>')
        persisted=dict(article,raw_article=dict(context=dict(v=1,status='ok',what='Përmbledhja e verifikuar pas publikimit.')))
        markup=(f'<article class="article-story"><a href="/kategori/sport">Sport</a><h1>Titulli</h1>'
                f'<figure><img src="{article["image_url"]}"></figure><dd class="ctx-what">{persisted["raw_article"]["context"]["what"]}</dd>'
                '<div style="font-size:17px;line-height:1.85"><p>Kopja e miratuar.</p></div></article>')
        class Response:
            status=200
            def __init__(self,data):self.data=data
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return self.data
        def http(request,**kwargs):
            return Response(json.dumps([persisted]).encode() if '/rest/v1/news_articles' in request.full_url else markup.encode())
        with tempfile.TemporaryDirectory() as temp,patch('urllib.request.urlopen',side_effect=http),patch.dict(os.environ,{
                'NEXT_PUBLIC_SUPABASE_URL':'https://testdb.example','SUPABASE_SERVICE_ROLE_KEY':'test-only'}):
            batch=Path(temp)/'batch.json';batch.write_text(json.dumps([article]),encoding='utf-8')
            verify_live(batch,site='https://testsite.example')
            persisted['body']='<p>Kopja u ndryshua pas miratimit.</p>'
            with self.assertRaises(RuntimeError):verify_live(batch,site='https://testsite.example')

    def test_readback_matches_the_persisted_context_summary_when_the_renderer_uses_it(self):
        article=dict(rows()[0],title='Titulli',excerpt='Përmbledhja fillestare.',body='<p>Kopja e miratuar.</p>',
                     context=dict(v=1,status='ok',what='Përmbledhja e verifikuar pas publikimit.'))
        markup=(f'<article class="article-story"><a href="/kategori/sport">Sport</a><h1>Titulli</h1>'
                f'<figure><img src="{article["image_url"]}"></figure><dd class="ctx-what">{article["context"]["what"]}</dd>'
                '<div style="font-size:17px;line-height:1.85"><p>Kopja e miratuar.</p></div></article>')
        verify_html(article,markup)
        with self.assertRaises(RuntimeError):verify_html(article,markup.replace(article['context']['what'],'Një pretendim tjetër.'))
        for invalid in (dict(v=True,status='ok',what=article['context']['what']),dict(v=2,status='ok',what=article['context']['what']),dict(v=1,status='empty',what=article['context']['what'])):
            with self.subTest(context=invalid),self.assertRaises(RuntimeError):verify_html(dict(article,context=invalid),markup)

    def test_context_embed_controls_are_separate_from_the_verified_article_body(self):
        article=dict(rows()[0],title='Titulli i lajmit',excerpt='Përmbledhja e verifikuar.',body='<p>Kopja e miratuar e lajmit.</p>')
        markup=(f'<article class="article-story"><a href="/kategori/sport">Sport</a><h1>{article["title"]}</h1>'
                f'<figure><img src="{article["image_url"]}"></figure><dl><dd class="ctx-what">{article["excerpt"]}</dd></dl>'
                '<div style="font-size:17px;line-height:1.85"><p>Kopja e miratuar e lajmit.</p>'
                '<figure class="ctx-media"><div class="ctx-gate"><p class="ctx-gate-title">Postim në Instagram</p>'
                '<p class="ctx-gate-note">Ky postim hapet nga Instagram.</p></div></figure></div></article>')
        verify_html(article,markup)
        with self.assertRaises(RuntimeError):
            verify_html(article,markup.replace('</figure></div></article>','</figure><p>Një pretendim i pamiratuar.</p></div></article>'))

    def test_expanded_batch_readback_fetches_every_expected_row(self):
        from unittest.mock import patch
        from codex_automation_support import _verify_batch_readback
        articles=[{'id':str(n),'category':'Showbiz'} for n in range(101)]
        def fetch(method,table,*,query):return articles[:int(query['limit'])]
        module=_verify_batch_readback.__module__
        with patch(module+'._article_row',side_effect=lambda article,key:dict(article)),patch(module+'._supabase_request',side_effect=fetch) as read:
            _verify_batch_readback('expanded-showbiz',articles)
        self.assertGreaterEqual(int(read.call_args.kwargs['query']['limit']),len(articles))

    def test_actual_story_markup_must_match_even_when_slug_and_flight_json_are_correct(self):
        article = {**rows()[0], 'title': 'Titulli i lajmit', 'excerpt': 'Përmbledhja e verifikuar.',
                   'body': '<p>Paragrafi i parë.</p><p>Paragrafi i dytë.</p>'}
        markup = (f'<article class="article-story"><a href="/kategori/sport">Sport</a>'
                  f'<h1>{article["title"]}</h1><figure><img src="/_next/image?url={quote(article["image_url"],safe="")}&amp;w=1600"></figure>'
                  f'<p>{article["excerpt"]}</p><div style="font-size:17px;line-height:1.85;color:#333333"><p>Paragrafi i parë.</p><p>Paragrafi i dytë.</p></div></article>')
        verify_html(article, markup)
        video_article = {**article, 'video_clip_url': 'https://www.youtube.com/watch?v=123456789ab'}
        start, end = markup.index('<figure>'), markup.index('</figure>') + len('</figure>')
        video_markup = markup[:start] + '<figure><iframe src="https://www.youtube-nocookie.com/embed/123456789ab"></iframe></figure>' + markup[end:]
        verify_html(video_article, video_markup)
        showbiz={**video_article,'category':'Showbiz'}
        showbiz_markup=markup.replace('>Sport<','>Showbiz<').replace('</article>','<figure><iframe src="https://www.youtube-nocookie.com/embed/123456789ab"></iframe></figure></article>')
        verify_html(showbiz,showbiz_markup)
        with self.assertRaises(RuntimeError):
            verify_html(showbiz,video_markup.replace('>Sport<','>Showbiz<'))
        with self.assertRaises(RuntimeError):
            verify_html(video_article, video_markup.replace('embed/123456789ab', 'embed/wrongIdHere'))
        with self.assertRaises(RuntimeError):
            verify_html(article, markup.replace('</div>', '<p>Unreviewed additional claim.</p></div>'))
        # Since 6 Nov 2026 the page shows the excerpt as the first row of the "Çfarë ndodhi" card.
        card = markup.replace(f'<p>{article["excerpt"]}</p>',
                              f'<dl class="ctx-card"><div class="ctx-row"><dt class="ctx-label">Çfarë ndodhi</dt>'
                              f'<dd class="ctx-what">{article["excerpt"]}</dd></div></dl>')
        self.assertNotEqual(card, markup)
        verify_html(article, card)
        with self.assertRaises(RuntimeError):
            verify_html(article, card.replace(article['excerpt'], 'Një përmbledhje tjetër.'))
        # Comments and controls after the body are not article copy.
        verify_html(article, markup.replace('</article>', '<div><p>A reader comment.</p></div></article>'))
        spaced = {**article, 'body': '<p>Paragrafi i parë.\n\nStill the first paragraph.</p><p>Paragrafi i dytë.</p>'}
        verify_html(spaced, markup.replace('Paragrafi i parë.</p>', 'Paragrafi i parë. Still the first paragraph.</p>'))
        entities = {**article, 'body': '<p>Nj&euml;? &amp; …</p><p>Paragrafi i dytë.</p>'}
        verify_html(entities, markup.replace('Paragrafi i parë.', 'Nj&amp;euml;? &amp; …'))
        literal_title = {**article, 'title': 'A &amp; B', 'excerpt': 'Literal <example> & text'}
        verify_html(literal_title, markup.replace(article['title'], 'A &amp;amp; B').replace(article['excerpt'], escape(literal_title['excerpt'])))
        for old, new in [(article['title'], 'Stale headline'), ('>Sport<', '>Botë<'),
                         ('Paragrafi i dytë.', 'Another article body.'),
                         ('photo-1.jpg', 'photo-other.jpg')]:
            wrong = markup.replace(old, new)
            # Correct copy hidden in hydration data cannot pass visible readback.
            wrong += '<script>' + escape(str(article)) + '</script>'
            with self.subTest(field=old), self.assertRaises(RuntimeError):
                verify_html(article, wrong)
        with self.assertRaises(RuntimeError):
            verify_html(article, '<html><a>' + article['slug'] + '</a><script>' + str(article) + '</script></html>')

    def test_exact_id_associations_content_category_and_photo_provenance_are_required(self):
        expected = rows()
        verify_rows(expected, copy.deepcopy(expected), 'slot')
        for field,value in [('slug','story-2'),('category','Showbiz'),('body','Different claims'),
                            ('image_url','https://images.example/chart.jpg'),('image_width',900),('image_height',400)]:
            saved=copy.deepcopy(expected);saved[0][field]=value
            if field=='slug':saved[1]['slug']='story-1'
            with self.subTest(field=field), self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')
        for field,value in [('image_caption','Today'),('image_subject','Someone else'),('image_rights',{'license':'Unknown'})]:
            saved=copy.deepcopy(expected);saved[0]['raw_article'][field]=value
            with self.subTest(field=field), self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')

    def test_wire_timezone_normalization_is_allowed_but_raw_provenance_stays_exact(self):
        expected=rows();saved=copy.deepcopy(expected)
        saved[0]['published_at']='2026-10-24T16:00:00.000000Z'
        verify_rows(expected,saved,'slot')
        saved[0]['published_at']='2026-10-24T17:00:00Z'
        with self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')

    def test_missing_extra_or_repeated_database_rows_fail(self):
        expected=rows()
        for saved in (expected[:1],expected+[expected[0]],expected+[dict(expected[0],id='extra')]):
            with self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')


if __name__=='__main__':unittest.main()
