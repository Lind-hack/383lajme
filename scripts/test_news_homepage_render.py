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
            self.assertLess(min(sizes),1_000_000)

    def test_root_redirect_ownership_is_required_before_browser(self):
        with self.assertRaisesRegex(ValueError,'outside'):
            render_homepage({**response(''), 'url':'https://unregistered.example/'},PUB)


if __name__ == '__main__':
    unittest.main()
