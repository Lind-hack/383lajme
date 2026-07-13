#!/usr/bin/env python3
"""Regression tests for transient image-CDN throttling."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import urllib.error
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SUPPORT = ROOT / "scripts" / "codex_automation_support.py"


def load_support():
    spec = importlib.util.spec_from_file_location("codex_automation_support", SUPPORT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def valid_png() -> bytes:
    payload = BytesIO()
    Image.new("RGB", (1, 1), "white").save(payload, format="PNG")
    return payload.getvalue()


def test_image_fetch_retries_http_429_once_then_succeeds():
    support = load_support()
    calls: list[object] = []
    waits: list[float] = []
    original_urlopen = support.urllib.request.urlopen
    original_sleep = support.time.sleep

    class Response:
        def read(self, _limit):
            return valid_png()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    try:
        def fake_urlopen(request, timeout):
            calls.append((request, timeout))
            if len(calls) == 1:
                raise urllib.error.HTTPError(request.full_url, 429, "Too Many Requests", {"Retry-After": "0"}, None)
            return Response()

        support.urllib.request.urlopen = fake_urlopen
        support.time.sleep = lambda seconds: waits.append(seconds)
        assert support._fetch_image_dimensions("https://images.example/rate-limited.png") == (1, 1)
        assert len(calls) == 2
        assert waits == [0]
    finally:
        support.urllib.request.urlopen = original_urlopen
        support.time.sleep = original_sleep


def test_normalize_does_not_abort_when_image_remains_rate_limited():
    support = load_support()
    article = {
        "body": "Lajm",
        "reading_time": 1,
        "image_url": "https://images.example/rate-limited.jpg",
        "image_width": 1400,
        "image_height": 800,
    }
    original_fetch = support._fetch_image_dimensions
    try:
        def rate_limited(url):
            raise urllib.error.HTTPError(url, 429, "Too Many Requests", {}, None)

        support._fetch_image_dimensions = rate_limited
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "2026-07-10T12.json"
            path.write_text(json.dumps([article]), encoding="utf-8")
            assert support.normalize_batch(path) == [article]
    finally:
        support._fetch_image_dimensions = original_fetch


if __name__ == "__main__":
    test_image_fetch_retries_http_429_once_then_succeeds()
    test_normalize_does_not_abort_when_image_remains_rate_limited()
    print("image rate-limit regression checks passed")
