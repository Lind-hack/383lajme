"""Set reasoning effort in the isolated news worker's Hermes configuration."""
import argparse
import os
from pathlib import Path
import yaml


def configure(home: Path, effort: str = "low") -> None:
    if home.resolve().name != "news-pipeline-hermes":
        raise ValueError("Refusing to modify a shared Hermes configuration")
    path = home / "config.yaml"
    config = yaml.safe_load(path.read_text()) or {}
    config.setdefault("agent", {})["reasoning_effort"] = effort
    temporary = path.with_suffix(".tmp")
    temporary.write_text(yaml.safe_dump(config, allow_unicode=True, sort_keys=False))
    os.chmod(temporary, path.stat().st_mode & 0o777)
    os.replace(temporary, path)
    print(f"383 NEWS REASONING: {effort}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--home", type=Path, required=True)
    parser.add_argument("--effort", choices=["low"], default="low")
    args = parser.parse_args()
    configure(args.home, args.effort)
