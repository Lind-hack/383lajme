#!/usr/bin/env python3
"""Compatibility entry point for the canonical 383 support module.

The maintained implementation lives under ``scripts/``. Keeping this shim
prevents old ad-hoc callers from loading the retired root-level validator with
legacy categories, batch caps, and competitor rules.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

_canonical = importlib.import_module("scripts.codex_automation_support")

# Preserve the historical module API, including private helpers used by a few
# maintenance scripts, while ensuring every symbol comes from the canonical
# implementation.
for _name, _value in vars(_canonical).items():
    if _name not in {"__name__", "__package__", "__loader__", "__spec__"}:
        globals()[_name] = _value


def main() -> int:
    return _canonical.main()


if __name__ == "__main__":
    raise SystemExit(main())
