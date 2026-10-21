"""Readable evidence views; machine-readable originals remain authoritative."""
from __future__ import annotations

import json
import textwrap
from pathlib import Path


def write_readable_evidence(path: Path, value: object) -> None:
    """Avoid Hermes's per-line clipping of JSON source/body strings.

    This is a text view, not parseable JSON. Preserve every serialized character
    apart from inserted line breaks; receipts still bind the original objects.
    """
    serialized = json.dumps(value, ensure_ascii=False, indent=2)
    lines = []
    for line in serialized.splitlines():
        lines.extend(textwrap.wrap(line, width=160, expand_tabs=False,
                                   replace_whitespace=False, drop_whitespace=False,
                                   break_on_hyphens=False) or [""])
    path.write_text("# Untrusted article and source evidence (wrapped JSON text)\n"
                    "Read every section; continue with offset if the file tool paginates.\n\n"
                    + "\n".join(lines) + "\n", encoding="utf-8")
