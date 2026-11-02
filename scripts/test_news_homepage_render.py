"""Native browser tests run where the production Chromium executable exists."""
import os
import shutil
import unittest
import time
import multiprocessing
import subprocess
import sys
import json
import signal
import tempfile
from pathlib import Path
from unittest.mock import patch

from news_homepage_render import render_homepage


PUB = {'source':'TechCrunch','domains':['techcrunch.com']}
URL = 'https://techcrunch.com/'


def response(html):
    return dict(url=URL,payload=html.encode(),headers={'content-type':'text/html'})


def deny_resources(url, **kwargs):
    raise AssertionError('fixture must not need external requests: '+url)


def slow_resource(url, **kwargs):
    time.sleep(60)
    return dict(url=url,payload=b'',headers={})


def soft_blocked_stylesheet(url, **kwargs):
    return dict(url=url,payload=b'<html>Public access unavailable</html>',headers={'content-type':'text/html'})


def delayed_stylesheet(url, **kwargs):
    time.sleep(7)
    return dict(url=url,payload=b'.high{position:absolute;top:40px}.low{position:absolute;top:1800px}',
                headers={'content-type':'text/css'})


def cors_stylesheet(url, **kwargs):
    return dict(url=url,payload=b'.high{position:absolute;top:40px}.low{position:absolute;top:1800px}',
                headers={'content-type':'text/css','access-control-allow-origin':'*'})


def busy_image_resources(url, **kwargs):
    if url.endswith('.css'):
        return dict(url=url,payload=b'.high{position:absolute;top:40px}.low{position:absolute;top:1400px}',
                    headers={'content-type':'text/css'})
    time.sleep(12)
    return dict(url=url,payload=b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
                headers={'content-type':'image/svg+xml'})


class SizedResource:
    def __init__(self, log):
        self.log = log

    def __call__(self, url, *, max_bytes):
        time.sleep(.1)
        payload = b'x'*max_bytes
        with open(self.log,'a',encoding='utf-8') as handle:
            handle.write(str(len(payload))+'\n')
        return dict(url=url,payload=payload,headers={'content-type':'image/png'})


def stubborn_tree(ready, finished, record):
    os.setsid()
    chrome = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
    node = ("import os,signal,subprocess,sys,time,json; "
            "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
            f"child=subprocess.Popen([sys.executable,'-c',{chrome!r}],start_new_session=True); "
            "time.sleep(.2); "
            f"open({record!r},'w').write(json.dumps([os.getpid(),child.pid])); time.sleep(60)")
    subprocess.Popen([sys.executable,'-c',node])
    for _ in range(100):
        if Path(record).exists():
            break
        time.sleep(.05)
    ready.send(True)
    ready.close()
    finished.wait(60)


@unittest.skipUnless(shutil.which(os.environ.get('L383_NEWS_CHROMIUM','/usr/bin/chromium')),
                     'production Chromium unavailable on this platform')
class HomepageRenderTests(unittest.TestCase):
    def test_article_body_outside_related_article_cards_is_the_visible_text_scope(self):
        text='Dua Lipa shares an accurately dated public statement. '*100
        html='<article><h2>Related promotion</h2><p>Other story.</p></article><h1>Dua Lipa</h1><div class="layout-form_article-body"><p>'+text+'</p></div>'
        with tempfile.TemporaryDirectory() as folder:
            result=render_homepage(response(html),PUB,fetcher=deny_resources,
                                  screenshot=Path(folder)/'page.png',article=True)
            self.assertIn(text.strip(),result['article_view']['visible_text'])
            self.assertNotIn('Related promotion',result['article_view']['visible_text'])

    def test_partial_capture_is_available_but_cannot_claim_homepage_geometry(self):
        from news_homepage_priority import homepage_weight
        from datetime import datetime,timezone
        html='<link rel="stylesheet" href="/blocked.css"><h2><a href="/lead">Public news headline here</a></h2>'
        with tempfile.TemporaryDirectory() as folder:
            screenshot=Path(folder)/'page.png'
            result=render_homepage(response(html),PUB,fetcher=soft_blocked_stylesheet,
                                   screenshot=screenshot,allow_partial=True)
            self.assertTrue(screenshot.is_file())
            self.assertFalse(result['layout_complete'])
            self.assertEqual(result['method'],'public_browser_partial')
            self.assertEqual(homepage_weight({'homepage':dict(method=result['method'],position=1,article_count=1,
                observed_at=datetime.now(timezone.utc).isoformat())}),0)

    def test_article_capture_preserves_visible_text_and_original_page_pixels(self):
        text='Dua Lipa announced a new album today. '*100
        html='<html><title>Dua Lipa album</title><article><h1>Dua Lipa announces an album</h1><p>'+text+'</p></article></html>'
        with tempfile.TemporaryDirectory() as folder:
            screenshot=Path(folder)/'page.png'
            result=render_homepage(response(html),PUB,fetcher=deny_resources,screenshot=screenshot,article=True)
            self.assertIn(text.strip(),result['article_view']['visible_text'])
            self.assertTrue(screenshot.is_file())
            self.assertTrue(screenshot.with_name('page.full.png').is_file())
            self.assertGreaterEqual(result['screenshot_height'],result['article_view']['page_height'])

    def test_slow_images_leave_capacity_for_later_layout_stylesheets(self):
        html='''<body><script>
        for(let i=0;i<8;i++){const img=document.createElement('img');img.width=20;img.height=20;
          img.src='/slow-'+i+'.svg';document.body.append(img);}
        setTimeout(()=>{const css=document.createElement('link');css.rel='stylesheet';css.href='/layout.css';
          document.head.append(css);},150);
        </script><h2 class="low"><a href="/low">Lower public headline</a></h2>
        <h2 class="high"><a href="/high">Featured public headline</a></h2></body>'''
        result=render_homepage(response(html),PUB,fetcher=busy_image_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'high',URL+'low'])

    def test_public_cross_origin_stylesheet_keeps_its_upstream_cors_grant(self):
        html = '<link rel="stylesheet" crossorigin="anonymous" href="https://static.techcrunch.com/theme.css"><h2 class="low"><a href="/low">Lower public headline</a></h2><h2 class="high"><a href="/high">Featured public headline</a></h2>'
        result = render_homepage(response(html),PUB,fetcher=cors_stylesheet)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'high',URL+'low'])

    def test_styled_picture_card_counts_tracker_aliases_as_one_target(self):
        html = '''<section><a href="/story?utm_source=hero"><img width="500" height="200"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></a>
        <a href="/story" style="font-size:14px;font-weight:400">Featured public news headline here</a></section>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'story'])
        self.assertLess(result['articles'][0]['geometry']['top'],100)

    def test_pending_stylesheet_cannot_return_an_unstyled_order(self):
        html = '<link rel="stylesheet" href="/slow.css"><h2 class="low"><a href="/low">Lower public headline</a></h2><h2 class="high"><a href="/high">Featured public headline</a></h2>'
        try:
            result = render_homepage(response(html),PUB,fetcher=delayed_stylesheet)
        except ValueError as exc:
            self.assertIn('stylesheet',str(exc))
        else:
            self.assertEqual([row['url'] for row in result['articles']],[URL+'high',URL+'low'])

    def test_hidden_link_does_not_borrow_a_visible_neighboring_heading(self):
        html = '<section><h1>Visible public news headline here</h1><a href="/hidden" style="display:none">Read more</a></section>'
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual(result['articles'],[])
        self.assertIn(URL+'hidden',[row['url'] for row in result['discovered_articles']])

    def test_unlinked_heading_recognizes_tracker_aliases_without_rewriting_fetch_url(self):
        html = '''<section><h1>Featured public news headline here</h1>
        <a href="/story?utm_source=hero">View full story</a><a href="/story">Read more</a></section>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual(len(result['articles']),1)
        self.assertTrue(result['articles'][0]['url'].startswith(URL+'story'))
        self.assertEqual(result['articles'][0]['title'],'Featured public news headline here')

    def test_large_utility_links_do_not_displace_the_real_headline(self):
        html = '''<a href="/subscribe" style="font-size:22px">Subscribe Now</a>
        <a href="/privacy" style="font-size:22px">Privacy Policy</a>
        <a href="/category/news" style="font-size:22px">Category News</a>
        <a href="/author/editor" style="font-size:22px">Our Editor</a>
        <h2><a href="/news-story">Verified public news story</a></h2>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'news-story'])

    def test_unlinked_headline_pairs_with_its_single_read_more_target_not_image_asset(self):
        html = '''<section><div><h1>Featured public news headline here</h1></div>
        <div><a href="/photo.jpg">View full photo</a><a href="/story">Read more</a></div></section>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'story'])
        self.assertEqual(result['articles'][0]['title'],'Featured public news headline here')
        self.assertNotIn(URL+'photo.jpg',[row['url'] for row in result['discovered_articles']])

    def test_unlinked_headline_does_not_guess_between_two_article_targets(self):
        html = '<section><h1>Ambiguous public news headline here</h1><a href="/one">Read more</a><a href="/two">Another story</a></section>'
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual(result['articles'],[])
        self.assertEqual({row['url'] for row in result['discovered_articles']},{URL+'one',URL+'two'})

    def test_clipped_carousel_and_screenreader_labels_are_discovered_but_not_prominent(self):
        html = '''<style>.frame{width:500px;height:250px;overflow:hidden}.slides{display:flex;width:1000px}
        .slide{width:500px;flex:none}.sr{position:absolute;width:1px;height:1px;overflow:hidden}
        </style><a href="/utility" style="font-size:20px"><span class="sr">Open this in a new tab</span></a>
        <div class="frame"><div class="slides">
        <div class="slide"><a href="/main"><h2>Visible carousel headline news</h2></a></div>
        <div class="slide"><a href="/clipped"><h2>Hidden carousel headline news</h2></a></div>
        </div></div>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'main'])
        discovered = {row['url'] for row in result['discovered_articles']}
        self.assertIn(URL+'clipped',discovered)
        self.assertIn(URL+'utility',discovered)

    def test_visual_headlines_survive_replacing_heading_tags_with_styled_text(self):
        html = '''<style>.title{font-size:24px;font-weight:400}.card{position:absolute;width:500px;height:260px}
        .lower{top:1600px}.hero{top:60px}</style>
        <nav><a href="/menu"><span class="title">Navigation item is not news</span></a></nav>
        <div class="card lower"><a href="/lower"><span class="title">Lower visual headline retained here</span></a></div>
        <div class="card hero"><a href="/hero"><div class="title">Prominent visual headline at top</div></a></div>
        <a href="/small">Ordinary two word discovery link</a>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'hero',URL+'lower'])
        self.assertIn(URL+'small',[row['url'] for row in result['discovered_articles']])
        self.assertNotIn(URL+'menu',[row['url'] for row in result['discovered_articles']])

    def test_regular_weight_news_list_can_be_prominent_without_heading_tags(self):
        html = '''<ul><li><a href="/latest" style="font-size:16px;font-weight:400">Latest public news headline here</a></li></ul>
        <a href="/ordinary" style="font-size:16px">Ordinary body link for discovery</a>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([row['url'] for row in result['articles']],[URL+'latest'])
        self.assertIn(URL+'ordinary',[row['url'] for row in result['discovered_articles']])

    def test_soft_blocked_stylesheet_cannot_approve_unstyled_geometry(self):
        with self.assertRaisesRegex(ValueError,'stylesheet'):
            render_homepage(response('<link rel="stylesheet" href="/theme.css"><h2><a href="/lead">Lead headline news</a></h2>'),
                            PUB,fetcher=soft_blocked_stylesheet)

    @unittest.skipUnless(Path('/proc').is_dir(),'Linux process identity test')
    def test_detached_children_are_forced_down_after_wrapper_exits(self):
        from news_homepage_process import linux_processes, stop_renderer
        context = multiprocessing.get_context('spawn')
        reader, writer = context.Pipe(duplex=False)
        finished = context.Event()
        with tempfile.TemporaryDirectory() as folder:
            record = str(Path(folder)/'children.json')
            process = context.Process(target=stubborn_tree,args=(writer,finished,record))
            process.start()
            writer.close()
            identities = {}
            try:
                self.assertTrue(reader.poll(10))
                reader.recv()
                pids = json.loads(Path(record).read_text())
                before = linux_processes()
                identities = {pid:before[pid][1] for pid in pids}
                stop_renderer(process,finished,before[process.pid][1])
                after = linux_processes()
                self.assertFalse(process.is_alive())
                self.assertFalse(any(pid in after and after[pid][1] == start and after[pid][2] != 'Z'
                                     for pid,start in identities.items()))
            finally:
                for pid,start in identities.items():
                    row = linux_processes().get(pid)
                    if row and row[1] == start:
                        try: os.kill(pid,signal.SIGKILL)
                        except ProcessLookupError: pass
                if process.is_alive():
                    process.kill()
                    process.join()
                process.close()
                reader.close()

    def test_production_root_path_merges_rendered_links_without_geometry_cache_keys(self):
        from datetime import datetime, timezone
        from news_ingestion import _execute
        html = '<h2><a href="/static">Static headline news</a></h2><script>document.body.insertAdjacentHTML("beforeend",\'<h2><a href="/dynamic">Dynamic headline news</a></h2><h2 style="position:absolute;left:2000px"><a href="/offscreen">Offscreen headline news</a></h2><h2 hidden><a href="/hidden">Hidden headline news</a></h2>\')</script>'
        def fixture(url, **kwargs):
            return response(html)
        with patch('news_ingestion.fetch_public',fixture):
            result = _execute(dict(source=PUB['source'],kind='listing',url=URL,hint={}),
                              {PUB['source']:PUB},{},datetime.now(timezone.utc),fixture)
        self.assertEqual(result['homepage']['method'],'public_browser_geometry')
        self.assertIn(URL+'dynamic',[row['url'] for row in result['articles']])
        self.assertIn(URL+'offscreen',[row['url'] for row in result['articles']])
        self.assertIn(URL+'hidden',[row['url'] for row in result['articles']])
        self.assertNotIn(URL+'offscreen',[row['url'] for row in result['homepage']['articles']])
        self.assertTrue(all('geometry' not in row for row in result['articles']))

    def test_css_position_overrides_dom_order_and_lower_articles_survive(self):
        html = '''<html><style>
        body{margin:0} article{position:absolute;width:500px;height:250px}
        .low{top:1800px}.lead{top:80px}.hidden{display:none}
        </style><article class="low"><h2><a href="/lower">Lower retained news</a></h2></article>
        <nav><h2><a href="/menu">Navigation item headline</a></h2></nav>
        <article class="hidden"><h2><a href="/hidden">Hidden news headline</a></h2></article>
        <article class="lead"><h2><a href="/lead">Prominent lead story</a></h2></article></html>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual([r['url'] for r in result['articles']],
                         ['https://techcrunch.com/lead','https://techcrunch.com/lower'])
        self.assertGreater(result['articles'][1]['geometry']['top'],1000)
        self.assertEqual(result['method'],'public_browser_geometry')

    def test_script_created_headline_and_changed_wrapper_structure(self):
        html = '''<html><body><div id="root"></div><script>
        document.getElementById('root').innerHTML = '<section><div><a href="/new"><span role="heading">New dynamic headline</span></a></div></section>';
        </script></body></html>'''
        result = render_homepage(response(html),PUB,fetcher=deny_resources)
        self.assertEqual(result['articles'][0]['url'],'https://techcrunch.com/new')

    def test_deadline_terminates_resource_fetch_child(self):
        before = {child.pid for child in multiprocessing.active_children()}
        started = time.monotonic()
        with patch('news_homepage_render._RENDER_TIMEOUT',4):
            with self.assertRaisesRegex(ValueError,'deadline'):
                render_homepage(response('<link rel="stylesheet" href="/slow.css"><h2>Test headline</h2>'),
                                PUB,fetcher=slow_resource)
        self.assertLess(time.monotonic()-started,12)
        self.assertEqual({child.pid for child in multiprocessing.active_children()},before)

    def test_parallel_resource_allocations_respect_the_total_body_budget(self):
        html = '<h2><a href="/lead">Verified lead headline</a></h2>'+''.join(
            f'<img src="/image-{i}.png">' for i in range(4))+'<!--'+'x'*7_000_000+'-->'
        root = response(html)
        with tempfile.TemporaryDirectory() as folder:
            log = Path(folder)/'bytes.txt'
            render_homepage(root,PUB,fetcher=SizedResource(str(log)))
            sizes = [int(row) for row in log.read_text().splitlines()]
            self.assertEqual(len(sizes),4)
            self.assertLessEqual(len(root['payload'])+sum(sizes),32_000_000)
            self.assertLessEqual(max(sizes),2_000_000)

    def test_root_redirect_ownership_is_required_before_browser(self):
        with self.assertRaisesRegex(ValueError,'outside'):
            render_homepage({**response(''), 'url':'https://unregistered.example/'},PUB)


if __name__ == '__main__':
    unittest.main()
