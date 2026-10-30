"""Terminate only the renderer's owned process tree, including detached Chrome."""
import os
import signal
import subprocess
import time
from pathlib import Path


def linux_processes():
    rows = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            fields = path.read_text().rsplit(')',1)[1].split()
            rows[int(path.parent.name)] = (int(fields[1]),fields[19],fields[0])
        except (OSError,ValueError,IndexError):
            pass
    return rows


def stop_renderer(process, finished, root_start):
    if os.name == 'nt':
        # The wrapper waits for our acknowledgement, preserving Windows ancestry.
        if process.is_alive():
            subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True)
        process.join(timeout=3)
        if process.is_alive():
            process.kill()
            process.join()
        return
    known = {process.pid:root_start}

    def extend():
        rows = linux_processes()
        while True:
            added = False
            live = {pid for pid,start in known.items() if pid in rows and rows[pid][1] == start}
            for pid,(parent,start,state) in rows.items():
                if parent in live and pid not in known:
                    known[pid] = start
                    added = True
            if not added:
                break
        return {pid for pid,start in known.items() if pid in rows
                and rows[pid][1] == start and rows[pid][2] != 'Z'}

    # Capture descendants before allowing the wrapper to exit/reparent them.
    live = extend()
    finished.set()
    deadline = time.monotonic()+2
    signalled = set()
    while live and time.monotonic() < deadline:
        for pid in live-signalled:
            try:
                os.kill(pid,signal.SIGTERM)
            except ProcessLookupError:
                pass
        signalled.update(live)
        process.join(timeout=.05)
        live = extend()
    # Force children independently of wrapper liveness and of Chrome's PGID.
    for pid in extend():
        try:
            os.kill(pid,signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.join(timeout=2)
    if process.is_alive():
        process.kill()
        process.join()
