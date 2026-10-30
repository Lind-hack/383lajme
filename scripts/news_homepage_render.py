"""Bounded Chromium geometry with public retrieval and no browsing credentials."""
import base64
import json
import multiprocessing
import os
import secrets
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from news_ingestion_protocol import (owned, is_article_path, NON_ARTICLE_EXTENSIONS, UTILITY_PATHS,
                                     NON_ARTICLE_PREFIXES, CATEGORY_INDEX_PREFIXES)
from read_news_source import fetch_public, PublicHTTPError
from news_homepage_process import linux_processes, stop_renderer


_BROWSERS = threading.BoundedSemaphore(2)
_RENDER_TIMEOUT = 42


def render_homepage(response, publisher, *, fetcher=fetch_public, screenshot=None):
    """Reuse the retrieved root document; public CSS/scripts/images may load.

    Browser HTTP is intercepted. The bridge reuses fetch_public's DNS validation,
    pinned connection, redirect checks, size bounds and HTTP access failures.
    No browser cookies, credentials, challenge solving or private URLs are sent.
    """
    if not owned(response['url'], publisher):
        raise ValueError('homepage redirected outside its registered publisher')
    if len(response['payload']) > 8_000_000:
        raise ValueError('homepage exceeds render byte limit')
    if os.name != 'nt' and not Path('/proc').is_dir():
        raise ValueError('renderer process cleanup requires Linux or Windows')
    if not _BROWSERS.acquire(timeout=90):
        raise ValueError('homepage render capacity busy')
    try:
        # The bridge and all of its socket-reading threads live in the child.
        # Terminating that child bounds slow-streaming responses too.
        context = multiprocessing.get_context('spawn')
        reader, writer = context.Pipe(duplex=False)
        finished = context.Event()
        process = context.Process(target=_render_worker,args=(writer,finished,response,publisher,fetcher,screenshot))
        process.start()
        root_start = linux_processes().get(process.pid,(None,None,None))[1] if os.name != 'nt' else None
        writer.close()
        try:
            if not reader.poll(_RENDER_TIMEOUT):
                raise ValueError('homepage render deadline')
            result = reader.recv()
            if 'error' in result:
                raise ValueError(result['error'])
            return result['result']
        except EOFError as exc:
            raise ValueError('homepage renderer exited without a result') from exc
        finally:
            reader.close()
            stop_renderer(process,finished,root_start)
            process.close()
    finally:
        _BROWSERS.release()


def _render_worker(writer, finished, response, publisher, fetcher, screenshot):
    if os.name != 'nt':
        os.setsid()
    try:
        writer.send({'result':_render(response,publisher,fetcher,screenshot)})
    except Exception as exc:
        writer.send({'error':str(exc)[:500]})
    finally:
        writer.close()
        finished.wait(timeout=60)


def _render(response, publisher, fetcher, screenshot):
    token = secrets.token_urlsafe(24)
    cache = {response['url']: response}
    lock = threading.Lock()
    network = threading.BoundedSemaphore(4)
    used = len(response['payload'])
    stopped = threading.Event()

    class Bridge(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            nonlocal used
            try:
                length = int(self.headers.get('Content-Length', 0))
                if self.path != '/'+token or not 0 < length <= 16384:
                    raise ValueError('invalid resource request')
                url = json.loads(self.rfile.read(length))['url']
                with network:
                    if stopped.is_set():
                        raise ValueError('render already ended')
                    with lock:
                        resource = cache.get(url)
                        if resource is None:
                            allowance = min(8_000_000,32_000_000-used)
                            if allowance <= 0:
                                raise ValueError('render resource byte budget exhausted')
                            used += allowance  # Reserve before parallel network requests.
                    if resource is None:
                        try:
                            resource = fetcher(url, max_bytes=allowance)
                        except PublicHTTPError:
                            # fetch_public checks error status before reading a body.
                            with lock:
                                used -= allowance
                            raise
                        with lock:
                            size = len(resource['payload'])
                            if size > allowance:
                                raise ValueError('public fetcher exceeded its reserved byte budget')
                            used -= allowance-size
                            cache[url] = cache[resource['url']] = resource
                data = json.dumps(dict(url=resource['url'],
                    content_type=resource['headers'].get('content-type') or 'application/octet-stream',
                    payload=base64.b64encode(resource['payload']).decode())).encode()
                self.send_response(200)
                self.send_header('Content-Length',str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception:
                try:
                    self.send_error(502,'public resource unavailable')
                except OSError:
                    pass

    server = ThreadingHTTPServer(('127.0.0.1',0),Bridge)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever,daemon=True).start()
    from codex_automation_support import SOURCE_URL_TRACKING_KEYS
    config = dict(url=response['url'],chromium=os.environ.get('L383_NEWS_CHROMIUM','/usr/bin/chromium'),
                  excluded_extensions=NON_ARTICLE_EXTENSIONS,
                  utility_paths=sorted(UTILITY_PATHS),
                  tracking_keys=sorted(SOURCE_URL_TRACKING_KEYS),
                  excluded_prefixes=sorted(NON_ARTICLE_PREFIXES),category_prefixes=sorted(CATEGORY_INDEX_PREFIXES),
                  bridge=f'http://127.0.0.1:{server.server_port}/{token}',screenshot=str(screenshot) if screenshot else None)
    env = {**os.environ,'NODE_PATH':os.environ.get('L383_NEWS_NODE_MODULES',
                '/opt/data/workspaces/383lajme/node_modules')}
    process = None
    try:
        process = subprocess.Popen([env.get('L383_NEWS_NODE','node'),str(Path(__file__).with_suffix('.cjs'))],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',
            env=env)
        output,error = process.communicate(json.dumps(config),timeout=40)
        if process.returncode:
            raise ValueError(f'homepage renderer exit {process.returncode}: '+error[:500])
        result = json.loads(output)
        if not owned(result['url'],publisher):
            raise ValueError('rendered homepage left its registered publisher')
        if result['failed_stylesheets']:
            raise ValueError('rendered layout incomplete: stylesheet retrieval failed')
        from news_homepage_priority import homepage_article_identity
        root = homepage_article_identity(result['url'])
        seen, articles = set(), []
        for row in result['articles']:
            identity = homepage_article_identity(row['url'])
            if owned(row['url'],publisher) and is_article_path(row['url']) and identity != root and identity not in seen:
                seen.add(identity)
                articles.append(row)
        result['articles'] = articles
        result['discovered_articles'] = [row for row in result['discovered_articles']
            if owned(row['url'],publisher) and is_article_path(row['url']) and homepage_article_identity(row['url']) != root]
        return result
    except subprocess.TimeoutExpired as exc:
        raise ValueError('homepage render deadline') from exc
    finally:
        # Leave a stuck Node/browser attached until the controller snapshots and
        # terminates the complete tree, including Chromium's detached process.
        stopped.set()
        server.shutdown()
        server.server_close()
