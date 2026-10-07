"""Atomic hourly outcome records; publication retries never regenerate a saved slot."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def save(path: Path, status: str, stage: str, batch: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if status == "failed" and completed(path):
        status = "published"
    data = {"status": status, "stage": stage, "batch": batch,
            "model": os.environ.get("L383_WRITER_MODEL", ""), "reasoning_effort": "low",
            "updated_at": datetime.now(timezone.utc).isoformat()}
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def completed(path: Path) -> bool:
    if not path.exists():
        return False
    return json.loads(path.read_text())["status"] in {"published", "complete"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["check", "save"])
    parser.add_argument("path", type=Path)
    parser.add_argument("--status", default="running")
    parser.add_argument("--stage", default="initialization")
    parser.add_argument("--batch", default="")
    args = parser.parse_args()
    if args.action == "check":
        raise SystemExit(0 if completed(args.path) else 1)
    save(args.path, args.status, args.stage, args.batch)
