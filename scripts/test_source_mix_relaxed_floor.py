#!/usr/bin/env python3
"""Regression: a valid eight-story, five-source batch must be publishable."""
import importlib.util
import json
import tempfile
from pathlib import Path

MODULE = Path(__file__).with_name("validate_source_mix.py")
spec = importlib.util.spec_from_file_location("source_mix", MODULE)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

articles = [
    {"url": f"https://{host}/story-{i}", "source": host}
    for i, host in enumerate([
        "reuters.com", "apnews.com", "bbc.co.uk", "dw.com",
        "aljazeera.com", "reuters.com", "apnews.com", "bbc.co.uk",
    ], 1)
]
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / "batch.json"
    path.write_text(json.dumps(articles), encoding="utf-8")
    assert module.validate(path) == 0
print("relaxed source-mix floor regression passed")
