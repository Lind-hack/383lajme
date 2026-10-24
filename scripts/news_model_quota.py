"""One run-scoped stop marker for explicit Codex account exhaustion."""
import os
from pathlib import Path


def exhausted() -> bool:
    path = os.environ.get('L383_MODEL_QUOTA_FILE', '')
    return bool(path) and Path(path).is_file()


def require_available() -> None:
    if exhausted():
        raise RuntimeError('383 MODEL QUOTA: account usage is exhausted for this run')


def observe_failure(stdout: str, stderr: str) -> None:
    text = (stdout + '\n' + stderr).casefold()
    # Ordinary transient HTTP429s must keep their normal retry behavior.
    if 'usage_limit_reached' not in text and not ('429' in text and 'usage limit has been reached' in text):
        return
    path = os.environ.get('L383_MODEL_QUOTA_FILE', '')
    if path:
        marker = Path(path)
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch(exist_ok=True)
