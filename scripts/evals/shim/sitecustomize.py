"""EVAL ONLY. Loaded through PYTHONPATH by the eval launcher, never in production.

Makes the Linux news runner work on this Windows machine and routes every
model call to fake_hermes.py:
  * `timeout --signal=TERM --kill-after=15s Ns cmd` -> cmd with a Python timeout
  * `bash` -> Git Bash (System32\\bash.exe is the WSL stub)
  * hermes chat / news_model_query.py / news_native_pixels.py -> fake_hermes.py
  * a no-op `fcntl` so the publication lock can be taken (single eval process)
"""
import os
import subprocess
import sys
import tempfile
import types
from pathlib import Path

# Both switches are required: the stand-in can never answer for Luna in a run that may publish.
if os.environ.get('L383_EVAL_SHIM') == '1' and os.environ.get('L383_QA_ONLY') == '1':
    FAKE = str(Path(__file__).with_name('fake_hermes.py'))
    GIT_BASH = os.environ.get('L383_EVAL_BASH', r'C:\Program Files\Git\bin\bash.exe')
    if 'fcntl' not in sys.modules:
        try:
            import fcntl  # noqa: F401
        except ImportError:
            stub = types.ModuleType('fcntl')
            stub.LOCK_EX, stub.LOCK_NB, stub.LOCK_UN, stub.LOCK_SH = 2, 4, 8, 1
            stub.flock = lambda *a, **k: None
            stub.lockf = lambda *a, **k: None
            sys.modules['fcntl'] = stub

    def _query_file(text):
        handle = tempfile.NamedTemporaryFile('w', suffix='.query.txt', delete=False, encoding='utf-8',
                                             dir=os.environ.get('L383_EVAL_TMP'))
        handle.write(text)
        handle.close()
        return handle.name

    def _rewrite(args):
        if not isinstance(args, (list, tuple)):
            return args, None
        args = [os.fspath(a) for a in args]
        limit = None
        if args and Path(args[0]).name in {'timeout', 'timeout.exe'}:
            rest = [a for a in args[1:] if not a.startswith('--')]
            limit = float(rest[0].rstrip('s'))
            args = args[1 + args[1:].index(rest[0]) + 1:]
        if not args:
            return args, limit
        name = Path(args[0]).name.lower()
        if name in {'bash', 'bash.exe'}:
            args[0] = GIT_BASH
        elif any(Path(a).name == 'news_native_pixels.py' for a in args[:3]):
            args = [sys.executable, FAKE, 'pixels', args[args.index('--image') + 1], args[args.index('--prompt') + 1]]
        elif any(Path(a).name == 'news_model_query.py' for a in args[:3]):
            args = [sys.executable, FAKE, 'text', args[args.index('--query-file') + 1]]
        elif 'chat' in args[:4] and args[-2:-1] and args[-2] in {'-q', '--query'} and (
                'hermes' in name or 'hermes_cli.main' in args):
            args = [sys.executable, FAKE, 'text', _query_file(args[-1])]
        return args, limit

    _Popen = subprocess.Popen

    class Popen(_Popen):
        def __init__(self, args, *a, **k):
            args, self._eval_limit = _rewrite(args)
            if k.get('start_new_session'):
                k.pop('start_new_session')
            super().__init__(args, *a, **k)

        def wait(self, timeout=None):
            limit = getattr(self, '_eval_limit', None)
            if limit is not None and timeout is None:
                try:
                    return super().wait(limit)
                except subprocess.TimeoutExpired:
                    self.kill()
                    super().wait(10)
                    self.returncode = 124
                    return 124
            return super().wait(timeout)

        def communicate(self, input=None, timeout=None):
            limit = getattr(self, '_eval_limit', None)
            if limit is not None and timeout is not None:
                timeout = min(timeout, limit + 20)
            return super().communicate(input, timeout)

    subprocess.Popen = Popen
