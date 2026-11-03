"""Fair, cross-process capacity limit for all seven desks' OAuth calls."""
from contextlib import contextmanager
import os
import sqlite3
import signal
import subprocess
import time
import uuid
from pathlib import Path


@contextmanager
def connect(database):
    connection = sqlite3.connect(database, timeout=2)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def alive(pid):
    if pid == os.getpid():
        return True
    if os.name == 'nt':
        # Never use os.kill(pid, 0) on Windows: it can terminate a process.
        import ctypes
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        try:
            return bool(ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))) and code.value == 259
        finally:
            ctypes.windll.kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


@contextmanager
def model_slot(command, deadline, *, cancelled=lambda: False):
    database = os.environ.get('L383_MODEL_SLOT_DB')
    if not database:
        yield lambda pid: None
        return
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    token = uuid.uuid4().hex
    desk = os.environ.get('L383_RUN_DESK', 'legacy')
    with connect(database) as connection:
        connection.execute('CREATE TABLE IF NOT EXISTS requests '
                           '(token TEXT PRIMARY KEY, desk TEXT, pid INTEGER, queued REAL, active INTEGER, child INTEGER)')
        connection.execute('INSERT INTO requests VALUES (?, ?, ?, ?, 0, NULL)',
                           (token, desk, os.getpid(), time.time()))
    try:
        while True:
            if cancelled() or time.monotonic() >= deadline:
                raise subprocess.TimeoutExpired(command, 0)
            with connect(database) as connection:
                connection.execute('BEGIN IMMEDIATE')
                rows = connection.execute('SELECT token, desk, pid, queued, active, child FROM requests').fetchall()
                for row in rows:
                    if not alive(row[2]):
                        if row[5] and alive(row[5]) and os.name == 'posix':
                            # A SIGKILLed caller cannot run its normal cleanup.
                            # Only signal the isolated session created by Popen.
                            try:
                                if os.getsid(row[5]) == row[5]:
                                    os.killpg(row[5], signal.SIGKILL)
                            except ProcessLookupError:
                                pass
                        connection.execute('DELETE FROM requests WHERE token = ?', (row[0],))
                rows = [row for row in rows if alive(row[2])]
                active = [row for row in rows if row[4]]
                waiting = sorted((row for row in rows if not row[4]),
                                 key=lambda row: (sum(a[1] == row[1] for a in active), row[3], row[0]))
                if len(active) < 5 and waiting and waiting[0][0] == token:
                    connection.execute('UPDATE requests SET active = 1 WHERE token = ?', (token,))
                    granted = True
                else:
                    granted = False
            if granted:
                break
            time.sleep(min(0.1, max(0, deadline - time.monotonic())))
        def register(pid):
            with connect(database) as connection:
                connection.execute('UPDATE requests SET child = ? WHERE token = ?', (pid, token))
        yield register
    finally:
        with connect(database) as connection:
            connection.execute('DELETE FROM requests WHERE token = ?', (token,))
