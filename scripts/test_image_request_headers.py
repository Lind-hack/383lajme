#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
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
def test_image_fetch_uses_browser_like_headers():
    support = load_support()
    original_urlopen = support.urllib.request.urlopen
    captured = {}
    payload = BytesIO()
    Image.new("RGB", (1, 1), "white").save(payload, format="PNG")
    class Response:
        def read(self, _limit): return payload.getvalue()
        def __enter__(self): return self
        def __exit__(self, *_): return False
    try:
        def fake_urlopen(request, timeout):
            captured["request"] = request
            return Response()
        support.urllib.request.urlopen = fake_urlopen
        assert support._fetch_image_dimensions("https://images.example/story.jpg") == (1, 1)
        headers = {key.lower(): value for key, value in captured["request"].header_items()}
        assert "mozilla/5.0" in headers["user-agent"].lower()
        assert "image/" in headers["accept"].lower()
    finally:
        support.urllib.request.urlopen = original_urlopen
if __name__ == "__main__":
    test_image_fetch_uses_browser_like_headers()
    print("image request header regression check passed")
