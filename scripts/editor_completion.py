#!/usr/bin/env python3
"""Bind an explicit editor acknowledgement to exact batch bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def receipt_path(batch: Path) -> Path:
    return batch.with_suffix(".editor-complete.json")


def fingerprint(batch: Path) -> dict:
    raw = batch.read_bytes()
    articles = json.loads(raw)
    if not isinstance(articles, list) or not articles:
        raise ValueError("No edited articles remain")
    return {"sha256": hashlib.sha256(raw).hexdigest(), "slugs": [article["slug"] for article in articles]}


def acknowledge(batch: Path) -> None:
    receipt_path(batch).write_text(json.dumps(fingerprint(batch)), encoding="utf-8")


def verify(batch: Path) -> None:
    if json.loads(receipt_path(batch).read_text(encoding="utf-8")) != fingerprint(batch):
        raise ValueError("Editor acknowledgement does not match this batch")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["acknowledge", "verify"])
    parser.add_argument("batch", type=Path)
    args = parser.parse_args()
    (acknowledge if args.action == "acknowledge" else verify)(args.batch)
    print("Editor completion " + args.action + " succeeded")
