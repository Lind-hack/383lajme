"""Reuse public entity lookups; never cache photo rights or article approvals."""
import json
import os
import tempfile
import threading
import time
from pathlib import Path

TTL = 86400
LIMIT = 2048
_lock = threading.RLock()
_path = None
_entries = {}


def _load():
    global _path, _entries
    configured = os.environ.get("L383_PHOTO_IDENTITY_CACHE", "")
    path = Path(configured) if configured else None
    if path != _path:
        _path, _entries = path, {}
        if path:
            try:
                saved = json.loads(path.read_text(encoding="utf-8"))
                if saved.get("version") == 1 and isinstance(saved.get("entries"), dict):
                    _entries = saved["entries"]
            except (OSError, ValueError, AttributeError):
                pass
    return path


def get(key):
    with _lock:
        if not _load():
            return None
        row = _entries.get(key)
        if not isinstance(row, dict):
            return None
        stamp = row.get("fetched_at")
        if type(stamp) not in (int, float) or not 0 <= time.time() - stamp <= TTL:
            return None
        return row.get("value")


def remember(key, value):
    with _lock:
        if _load():
            _entries[key] = {"fetched_at": time.time(), "value": value}


def save():
    with _lock:
        path = _load()
        if not path:
            return
        now = time.time()
        valid = {key: row for key, row in _entries.items() if isinstance(row, dict)
                 and type(row.get("fetched_at")) in (int, float)
                 and 0 <= now - row["fetched_at"] <= TTL}
        valid = dict(sorted(valid.items(), key=lambda item: -item[1]["fetched_at"])[:LIMIT])
        temporary = None
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                             prefix=".photo-identity-", delete=False) as output:
                temporary = Path(output.name)
                json.dump({"version": 1, "entries": valid}, output, ensure_ascii=False)
            os.replace(temporary, path)
        except OSError:
            if temporary:
                try:
                    temporary.unlink(missing_ok=True)
                except OSError:
                    pass
            print("383 PHOTO IDENTITY cache unavailable; current lookups remain usable")
