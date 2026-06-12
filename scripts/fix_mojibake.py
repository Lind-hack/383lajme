"""One-time repair for UTF-8-read-as-cp1252 mojibake in lib/mock-data.ts.

The fix_bodies*.ps1 scripts re-wrote the file with the wrong codec, turning
"për Kosovën" into "pÃ«r KosovÃ«n" and mangling flag emojis. Reversing it:
encode each affected line back to cp1252 bytes, then decode those bytes as
UTF-8. Lines containing cp1252-unmappable characters are logged and left
unchanged for manual review.

Usage (from the 383 repo root):
    python scripts/fix_mojibake.py
"""

import re
import sys
from pathlib import Path

TARGET = Path(__file__).parent.parent / "lib" / "mock-data.ts"
# Mojibake signature: double-encoded Latin Extended (Ã), punctuation (â€),
# or emoji (ðŸ). Legit Albanian never contains these sequences.
SIGNATURE = re.compile(r"Ã|â€|ðŸ")


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    lines = text.split("\n")
    fixed = 0
    skipped: list[int] = []

    for i, line in enumerate(lines):
        if not SIGNATURE.search(line):
            continue
        try:
            repaired = line.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError) as err:
            skipped.append(i + 1)
            print(f"  line {i + 1}: left unchanged ({err})", file=sys.stderr)
            continue
        lines[i] = repaired
        fixed += 1

    TARGET.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"Repaired {fixed} lines in {TARGET}")
    if skipped:
        print(f"Manual review needed on lines: {skipped}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
