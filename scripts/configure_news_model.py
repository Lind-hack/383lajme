"""Set reasoning effort in the isolated news worker's Hermes configuration."""
import argparse
import os
from pathlib import Path
import yaml


def configure(home: Path, effort: str = "max") -> None:
    if home.resolve().name != "news-pipeline-hermes":
        raise ValueError("Refusing to modify a shared Hermes configuration")
    path = home / "config.yaml"
    config = yaml.safe_load(path.read_text()) or {}
    config.setdefault("agent", {})["reasoning_effort"] = effort
    # Keep Hermes's internal fallback from bypassing the pipeline model contract.
    config["fallback_model"] = None
    # Hermes does not yet recognize Luna as a reasoning model: its implicit
    # non-streaming watchdog aborts valid max-effort calls after 90 seconds.
    # Scope the override to this model in the isolated news home. The worker
    # still enforces the shorter remaining stage/process deadline.
    model = config.setdefault("providers", {}).setdefault("openai-codex", {}).setdefault("models", {}).setdefault("gpt-6-luna", {})
    model["stale_timeout_seconds"] = max(600, float(model.get("stale_timeout_seconds") or 0))
    model["timeout_seconds"] = max(900, float(model.get("timeout_seconds") or 0))
    temporary = path.with_suffix(".tmp")
    temporary.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False))
    os.chmod(temporary, path.stat().st_mode & 0o777)
    os.replace(temporary, path)
    print(f"383 NEWS REASONING: {effort}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--home", type=Path, required=True)
    parser.add_argument("--effort", choices=["max"], default="max")
    args = parser.parse_args()
    configure(args.home, args.effort)
