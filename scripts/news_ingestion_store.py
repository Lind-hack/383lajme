"""Durable source retrieval queue; publication shortlists never delete it."""
import hashlib
import json
import sqlite3
import time
import os
import errno
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path


@contextmanager
def collector_lock(path):
    """Only one collector may recover or mutate a source queue at a time."""
    path = Path(str(path)+'.lock')
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('a+b') as handle:
        if os.name == 'nt':
            import msvcrt
            handle.write(b'0')
            handle.flush()
            handle.seek(0)
            acquire = lambda: msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
            release = lambda: msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)
        else:
            import fcntl
            acquire = lambda: fcntl.flock(handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
            release = lambda: fcntl.flock(handle.fileno(),fcntl.LOCK_UN)
        try:
            acquire()
        except OSError as exc:
            if exc.errno not in (errno.EACCES,errno.EAGAIN):
                raise
            yield False
            return
        try:
            yield True
        finally:
            release()


class Inventory:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True,exist_ok=True)
        self.db = sqlite3.connect(path,timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, source TEXT NOT NULL, kind TEXT NOT NULL,
                url TEXT NOT NULL, hint TEXT NOT NULL, priority INTEGER NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending', next_try REAL NOT NULL DEFAULT 0,
                attempts INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
                seen_run TEXT NOT NULL, done_run TEXT NOT NULL DEFAULT '',
                url_identity TEXT NOT NULL DEFAULT '');
            CREATE INDEX IF NOT EXISTS task_queue ON tasks(state,next_try,priority);
            CREATE INDEX IF NOT EXISTS task_dispatch ON tasks(state,priority);
            CREATE INDEX IF NOT EXISTS task_source ON tasks(source,state,priority);
            CREATE INDEX IF NOT EXISTS task_recent ON tasks(
                state,priority,julianday(json_extract(hint,'$.published')) DESC,seen_run DESC);
            CREATE INDEX IF NOT EXISTS task_source_recent ON tasks(
                source,state,priority,julianday(json_extract(hint,'$.published')) DESC,seen_run DESC);
            CREATE TABLE IF NOT EXISTS dispatches (
                source TEXT PRIMARY KEY, articles INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS articles (
                url TEXT PRIMARY KEY, source TEXT NOT NULL, hint TEXT NOT NULL,
                evidence TEXT NOT NULL, fetched_at REAL NOT NULL, status TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS checkpoints (
                source TEXT PRIMARY KEY, completed_at REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS scopes (
                source TEXT PRIMARY KEY, since REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS homepage_pages (
                url TEXT PRIMARY KEY, source TEXT NOT NULL, observed_at REAL NOT NULL,
                articles TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}');
            CREATE TABLE IF NOT EXISTS homepage_links (
                homepage TEXT NOT NULL, source TEXT NOT NULL, article_identity TEXT NOT NULL,
                position INTEGER NOT NULL, observed_at REAL NOT NULL,
                PRIMARY KEY(homepage,article_identity));
            CREATE INDEX IF NOT EXISTS homepage_rank ON homepage_links(position,observed_at,source);
            CREATE INDEX IF NOT EXISTS article_source ON articles(source,status);
            CREATE INDEX IF NOT EXISTS article_recent ON articles(fetched_at,status);
        ''')
        if 'url_identity' not in {row[1] for row in self.db.execute('PRAGMA table_info(tasks)')}:
            try:
                self.db.execute("ALTER TABLE tasks ADD COLUMN url_identity TEXT NOT NULL DEFAULT ''")
            except sqlite3.OperationalError:
                if 'url_identity' not in {row[1] for row in self.db.execute('PRAGMA table_info(tasks)')}:
                    raise
        # Resumable even if a previous process stopped after ALTER or mid-backfill.
        self.db.execute("CREATE INDEX IF NOT EXISTS task_missing_identity ON tasks(id) WHERE kind='article' AND url_identity=''")
        rows = self.db.execute("SELECT id,url FROM tasks WHERE kind='article' AND url_identity='' "
                               "AND (url LIKE 'http://%' OR url LIKE 'https://%')").fetchall()
        if rows:
            from news_homepage_priority import homepage_article_identity
            with self.db:
                self.db.executemany("UPDATE tasks SET url_identity=? WHERE id=? AND url_identity=''",
                    [(identity,row['id']) for row in rows if (identity := homepage_article_identity(row['url']))])
        self.db.execute('CREATE INDEX IF NOT EXISTS task_identity ON tasks(source,kind,url_identity)')
        if 'metadata' not in {row[1] for row in self.db.execute('PRAGMA table_info(homepage_pages)')}:
            self.db.execute("ALTER TABLE homepage_pages ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'")
            self.db.commit()
        if 'article_streak' not in {row[1] for row in self.db.execute('PRAGMA table_info(dispatches)')}:
            try:
                self.db.execute('ALTER TABLE dispatches ADD COLUMN article_streak INTEGER NOT NULL DEFAULT 0')
            except sqlite3.OperationalError:
                if 'article_streak' not in {row[1] for row in self.db.execute('PRAGMA table_info(dispatches)')}:
                    raise
            self.db.commit()

    def close(self):
        self.db.close()

    def save_homepage(self, source, url, articles, now, *, method='public_html_dom_order', viewport=None,
                      render_error='', discovered_articles=None):
        # Replace the whole page, including an empty result. Feed/sitemap updates
        # must neither overwrite the observation nor invalidate article caches.
        from news_homepage_priority import homepage_article_identity
        urls = list(dict.fromkeys(identity for row in articles
                                  if (identity := homepage_article_identity(row['url']))))
        geometry = {}
        for row in articles:
            geometry.setdefault(homepage_article_identity(row['url']),row.get('geometry'))
        metadata = dict(method=method,viewport=viewport,geometry=geometry,render_error=render_error,
                        discovered_articles=discovered_articles if discovered_articles is not None else articles)
        from news_homepage_priority import homepage_weight
        links = []
        for position,identity in enumerate(urls,1):
            attention = dict(position=position,article_count=len(urls),observed_at=now.isoformat(),
                             method=method,geometry=geometry[identity],viewport=viewport)
            if homepage_weight({'homepage':attention},now) > 0:
                links.append((url,source,identity,position,now.timestamp()))
        with self.db:
            self.db.execute('INSERT INTO homepage_pages(url,source,observed_at,articles,metadata) VALUES(?,?,?,?,?) '
                            'ON CONFLICT(url) DO UPDATE SET source=excluded.source,observed_at=excluded.observed_at,'
                            'articles=excluded.articles,metadata=excluded.metadata',
                            (url,source,now.timestamp(),json.dumps(urls),json.dumps(metadata)))
            self.db.execute('DELETE FROM homepage_links WHERE homepage=?',(url,))
            self.db.executemany('INSERT INTO homepage_links VALUES(?,?,?,?,?)',links)

    def cached_homepage(self, url, now, *, max_age=900):
        page = self.db.execute('SELECT * FROM homepage_pages WHERE url=? AND observed_at BETWEEN ? AND ?',
                              (url,now.timestamp()-max_age,now.timestamp())).fetchone()
        if page is None:
            return None
        metadata = json.loads(page['metadata'])
        if metadata.get('method') != 'public_browser_geometry':
            return None
        return dict(url=url,method=metadata['method'],viewport=metadata['viewport'],
                    discovered_articles=metadata.get('discovered_articles',[]),
                    captured_at=page['observed_at'],articles=[dict(url=url,title='',published='',
                        geometry=metadata['geometry'].get(url)) for url in json.loads(page['articles'])])

    def homepage_status(self, source, now):
        result = []
        for page in self.db.execute('SELECT * FROM homepage_pages WHERE source=?',(source,)):
            metadata = json.loads(page['metadata'])
            result.append(dict(url=page['url'],method=metadata.get('method','public_html_dom_order'),
                age_seconds=round(now.timestamp()-page['observed_at'],1),
                headline_links=len(json.loads(page['articles'])),render_error=metadata.get('render_error','')))
        return result

    def homepage_observations(self, now):
        from news_homepage_priority import MAX_AGE_SECONDS
        from datetime import timezone
        result = {}
        for page in self.db.execute('SELECT * FROM homepage_pages WHERE observed_at BETWEEN ? AND ?',
                                   (now.timestamp()-MAX_AGE_SECONDS,now.timestamp())):
            urls = json.loads(page['articles'])
            metadata = json.loads(page['metadata'])
            for position,url in enumerate(urls,1):
                observation = dict(url=page['url'],source=page['source'],position=position,article_count=len(urls),
                    observed_at=datetime.fromtimestamp(page['observed_at'],timezone.utc).isoformat(),
                    method=metadata.get('method','public_html_dom_order'))
                if observation['method'] == 'public_browser_geometry':
                    observation.update(geometry=metadata['geometry'].get(url),viewport=metadata['viewport'])
                if url not in result or position < result[url]['position']:
                    result[url] = observation
        return result

    def enqueue(self, task, run, *, refresh=False, commit=True):
        from news_homepage_priority import homepage_article_identity
        identity = hashlib.sha256(json.dumps([task['source'],task['kind'],task['url']]).encode()).hexdigest()
        previous = self.db.execute('SELECT * FROM tasks WHERE id=?',(identity,)).fetchone()
        hint = json.dumps(task.get('hint',{}),ensure_ascii=False,sort_keys=True)
        if previous is None:
            self.db.execute('INSERT INTO tasks(id,source,kind,url,hint,priority,seen_run,url_identity) VALUES(?,?,?,?,?,?,?,?)',
                (identity,task['source'],task['kind'],task['url'],hint,task.get('priority',5),run,
                 homepage_article_identity(task['url']) if task['kind']=='article' else ''))
        else:
            prior_hint = json.loads(previous['hint'])
            incoming = task.get('hint',{})
            merged = {**prior_hint,**{key:value for key,value in incoming.items() if value not in ('',None,[])}}
            hint = json.dumps(merged,ensure_ascii=False,sort_keys=True)
            pending = (refresh or previous['hint'] != hint) and previous['done_run'] != run
            if pending and task['kind']=='article' and previous['state']=='done' and previous['hint']==hint:
                row = self.db.execute('SELECT evidence FROM articles WHERE url=?',(task['url'],)).fetchone()
                if row is not None:
                    evidence = json.loads(row[0])
                    try:
                        published = datetime.fromisoformat(evidence.get('published') or prior_hint.get('published') or '')
                    except (TypeError,ValueError):
                        published = None
                    if (evidence.get('status')=='text_extracted' and published and published.tzinfo
                            and published.timestamp() < time.time()-86400):
                        pending = False  # An unchanged old URL was already retrieved.
            state = 'pending' if pending else previous['state']
            self.db.execute('UPDATE tasks SET hint=?,priority=?,state=?,seen_run=? WHERE id=?',
                (hint,min(previous['priority'],task.get('priority',5)),state,run,identity))
        if commit:
            self.db.commit()
        return identity

    def enqueue_many(self, tasks, run, *, refresh=False):
        """Commit one discovery document atomically, rather than fsync per URL."""
        with self.db:
            for task in tasks:
                self.enqueue(task,run,refresh=refresh,commit=False)

    def ready(self, now=None, *, limit=None, exclude_sources=(), source=None, recent=False,
              articles_only=False, indexes_only=False, allow_homepages=True):
        now = time.time() if now is None else now
        clause = ' AND source NOT IN ('+','.join('?' for _ in exclude_sources)+')' if exclude_sources else ''
        if source is not None:
            clause += ' AND source=?'
        if articles_only:
            clause += " AND kind='article'"
        if indexes_only:
            clause += " AND kind<>'article'"
        if not allow_homepages:
            clause += " AND NOT (kind='listing' AND COALESCE(json_extract(hint,'$._homepage_root'),0)=1)"
        suffix = ' LIMIT ?' if limit is not None else ''
        parameters = (now,*exclude_sources,*((source,) if source is not None else ()),
                      *((limit,) if limit is not None else ()))
        # Dates order retrieval only; publication still verifies the actual
        # article timestamp. Undated discoveries use their latest sighting.
        order = ("priority,julianday(json_extract(hint,'$.published')) DESC,seen_run DESC,rowid"
                 if recent else 'priority,rowid')
        table = ('tasks INDEXED BY '+('task_source_recent' if source is not None else 'task_recent')
                 if recent else 'tasks')
        return [{**dict(row),'hint':json.loads(row['hint'])} for row in self.db.execute(
            "SELECT * FROM "+table+" WHERE state='pending' AND next_try<=?"+clause+' ORDER BY '+order+suffix,parameters)]

    def backlog_turn(self, source):
        """Reserve every fifth article request per publisher across restarts."""
        row = self.db.execute('SELECT articles FROM dispatches WHERE source=?',(source,)).fetchone()
        return row is not None and row[0] % 5 == 4

    def index_turn(self, source):
        row = self.db.execute('SELECT article_streak FROM dispatches WHERE source=?',(source,)).fetchone()
        return row is not None and row[0] >= 3

    def homepage_task(self, now=None, *, exclude_sources=(), source=None):
        """Indexed current homepage candidates; never replace source-cache hints."""
        from news_homepage_priority import MAX_AGE_SECONDS
        now = time.time() if now is None else now
        clause = ' AND h.source NOT IN ('+','.join('?' for _ in exclude_sources)+')' if exclude_sources else ''
        if source is not None:
            clause += ' AND h.source=?'
        row = self.db.execute('''SELECT t.* FROM homepage_links AS h INDEXED BY homepage_rank
            CROSS JOIN tasks AS t INDEXED BY task_identity
            ON t.source=h.source AND t.kind='article' AND t.url_identity=h.article_identity
            WHERE h.observed_at BETWEEN ? AND ? AND t.state='pending' AND t.next_try<=?'''+clause+'''
            ORDER BY h.position,t.priority,julianday(json_extract(t.hint,'$.published')) DESC,t.seen_run DESC,t.rowid LIMIT 1''',
            (now-MAX_AGE_SECONDS,now,now,*exclude_sources,*((source,) if source is not None else ()))).fetchone()
        return {**dict(row),'hint':json.loads(row['hint'])} if row else None

    def running(self, identity):
        self.db.execute('''INSERT INTO dispatches(source,articles,article_streak)
            SELECT source,kind='article',kind='article' FROM tasks WHERE id=?
            ON CONFLICT(source) DO UPDATE SET articles=articles+excluded.articles,
                article_streak=CASE WHEN excluded.articles=1 THEN article_streak+1 ELSE 0 END''',(identity,))
        self.db.execute("UPDATE tasks SET state='running' WHERE id=?",(identity,))
        self.db.commit()

    def recover(self):
        self.db.execute("UPDATE tasks SET state='pending' WHERE state='running'")
        self.db.commit()

    def since(self, source, now):
        row = self.db.execute('SELECT completed_at FROM checkpoints WHERE source=?',(source,)).fetchone()
        if row is not None:
            return row[0]-3600  # Overlap protects publication during pagination.
        self.db.execute('INSERT OR IGNORE INTO scopes VALUES(?,?)',(source,now-86400))
        self.db.commit()
        return self.db.execute('SELECT since FROM scopes WHERE source=?',(source,)).fetchone()[0]

    def articles(self, *, max_age=None, status=None):
        conditions, values = [], []
        if max_age is not None:
            conditions.append('fetched_at BETWEEN ? AND ?')
            current = time.time()
            values.extend((current-max_age,current))
        if status is not None:
            conditions.append('status=?')
            values.append(status)
        where = ' WHERE '+' AND '.join(conditions) if conditions else ''
        for row in self.db.execute('SELECT * FROM articles'+where,values):
            yield {**dict(row),'hint':json.loads(row['hint']),'evidence':json.loads(row['evidence'])}

    def finish(self, identity, run, *, next_try=0):
        self.db.execute("UPDATE tasks SET state='done',done_run=?,error='',next_try=?,attempts=attempts+1 WHERE id=?",
                        (run,next_try,identity))
        self.db.commit()

    def fail(self, identity, error, *, retry_after=300):
        # Keep the task: a timeout or blocked page is not successful coverage.
        self.db.execute("UPDATE tasks SET state='pending',error=?,next_try=?,attempts=attempts+1 WHERE id=?",
                        (str(error)[:300],time.time()+max(1,retry_after),identity))
        self.db.commit()

    def save_evidence(self, source, url, hint, evidence):
        self.db.execute('INSERT INTO articles(url,source,hint,evidence,fetched_at,status) VALUES(?,?,?,?,?,?) '
                        'ON CONFLICT(url) DO UPDATE SET hint=excluded.hint,evidence=excluded.evidence,'
                        'fetched_at=excluded.fetched_at,status=excluded.status',
                        (url,source,json.dumps(hint,sort_keys=True),json.dumps(evidence,ensure_ascii=False),time.time(),evidence.get('status','unavailable')))
        self.db.commit()

    def evidence(self, url, hint=None, *, max_age=3600):
        row = self.db.execute('SELECT * FROM articles WHERE url=?',(url,)).fetchone()
        if row is None or not 0 <= time.time()-row['fetched_at'] <= max_age:
            return None
        if row['status'] != 'text_extracted':
            return None
        # A publisher's changed metadata invalidates cached reporting immediately.
        if hint is not None and row['hint'] != json.dumps(hint,sort_keys=True):
            return None
        return json.loads(row['evidence'])

    def source_status(self, source):
        counts = dict(self.db.execute("SELECT state,COUNT(*) FROM tasks WHERE source=? GROUP BY state",(source,)).fetchall())
        pending = counts.get('pending',0)+counts.get('running',0)
        errors = self.db.execute("SELECT COUNT(*) FROM tasks WHERE source=? AND error<>''",(source,)).fetchone()[0]
        retrieved = self.db.execute('SELECT COUNT(*) FROM articles WHERE source=?',(source,)).fetchone()[0]
        readable = self.db.execute("SELECT COUNT(*) FROM articles WHERE source=? AND status='text_extracted'",(source,)).fetchone()[0]
        statuses=dict(self.db.execute('SELECT status,COUNT(*) FROM articles WHERE source=? GROUP BY status',(source,)).fetchall())
        return {'source':source,'pending':pending,'failed_tasks':errors,'stored_articles':retrieved,
                'stored_readable':readable,'readability_statuses':statuses,'public_routes_exhausted':pending==0 and errors==0 and bool(counts)}

    def checkpoint(self, source, started_at):
        if not self.source_status(source)['public_routes_exhausted']:
            return False
        self.db.execute('INSERT INTO checkpoints VALUES(?,?) ON CONFLICT(source) DO UPDATE SET completed_at=excluded.completed_at',
                        (source,started_at))
        self.db.commit()
        return True
