"""Atomic JSON state and timezone-aware age checks for news workers."""
from datetime import datetime
import json
from pathlib import Path


def atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def age(value, now):
    try:
        return (now - datetime.fromisoformat(value.replace('Z', '+00:00'))).total_seconds()
    except (ValueError, TypeError, AttributeError):
        return float('inf')
