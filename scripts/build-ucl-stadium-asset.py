#!/usr/bin/env python3
"""Build the Champions League stadium ornament for the Tregu market card.

The card is a dark navy night scene and the source is a night photograph, so the
alpha channel is derived from luminance rather than a keyed background: the dark
sky falls away, the lit dome and light arcs stay. That works in our favour twice
over -- the foreground foliage is dark enough to key out on its own (no manual
masking), and the layer is composited with `mix-blend-mode: screen`, where any
residual near-black fringe is a no-op. The keying does not have to be surgical.

The source photograph is not committed; pass it with --source. Only the generated
.webp is checked in.

    python scripts/build-ucl-stadium-asset.py --source path/to/reference.jpeg

Pure Pillow on purpose: numpy is unusable in the venv on this machine (cp312
binaries under a cp311 interpreter).
"""

import argparse
from pathlib import Path

from PIL import Image

# Measured from the 1920x1080 reference: the dome and its light arcs span
# x 180-1900, and the structure band is y 355-800. Below y 840 the bright
# fraction is 0.000, which is why the foliage disappears for free.
CROP = (200, 355, 1880, 800)

# Luminance -> alpha ramp. L<=26 is sky (62% of the frame sits under L=40),
# opaque by L~150.
ALPHA_FLOOR = 26
ALPHA_SPAN = 124

OUT_WIDTH = 1000          # covers ~500 CSS px at 2x; widest card column is 449px
WEBP_QUALITY = 76

# The real size lever. Colour quality barely matters here (q72 -> q48 moves the
# file 4%): almost all the weight is the alpha channel, which WebP stores
# losslessly at alpha_quality >= 80. There is a cliff at 80 -> 70 (110 KB ->
# 52 KB), and lossy alpha costs us nothing visible because this alpha is a soft
# luminance ramp rather than a hard matte, composited with mix-blend-mode:
# screen over navy.
WEBP_ALPHA_QUALITY = 72
WEBP_METHOD = 6


def build(source: Path, out: Path) -> None:
    im = Image.open(source).convert("RGB").crop(CROP)

    alpha = im.convert("L").point(
        lambda v: 0 if v < ALPHA_FLOOR else min(255, int((v - ALPHA_FLOOR) * 255 / ALPHA_SPAN))
    )
    im = im.convert("RGBA")
    im.putalpha(alpha)

    # Trim fully-transparent margins so the dome's base lands on the bottom pixel
    # row. The CSS anchors this to bottom:0, so transparent padding underneath
    # would render as a stadium floating above the card edge.
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        im = im.crop(box)

    height = round(im.height * OUT_WIDTH / im.width)
    im = im.resize((OUT_WIDTH, height), Image.LANCZOS)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=WEBP_QUALITY, alpha_quality=WEBP_ALPHA_QUALITY, method=WEBP_METHOD)

    print(f"wrote {out}  {im.width}x{im.height}  {out.stat().st_size / 1024:.1f} KB")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True, type=Path, help="reference photograph")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public/images/tregu/ucl-stadium-night-v1.webp",
    )
    args = ap.parse_args()
    build(args.source, args.out)


if __name__ == "__main__":
    main()
