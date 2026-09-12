#!/usr/bin/env python3
"""Build the competition ornaments for the Tregu market cards.

Two subjects, two keying strategies, because the sources differ:

  ucl-stadium  luminance key. A night photograph on a dark card, so the sky
               falls away with the shadows and the lit dome stays.
  uel-trophy   saturation key. The Europa source is 91% saturated red/orange
               and the trophy is near-grey metal, so hue purity separates them
               far more cleanly than brightness would.

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

from PIL import Image, ImageFilter

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
    ap.add_argument("--preset", default="ucl-stadium", choices=["ucl-stadium", "uel-trophy"])
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public/images/tregu/ucl-stadium-night-v1.webp",
    )
    args = ap.parse_args()
    if args.preset == "uel-trophy":
        out = args.out
        if out.name == "ucl-stadium-night-v1.webp":
            out = out.parent / "uel-trophy-v1.webp"
        build_trophy(args.source, out)
    else:
        build(args.source, args.out)




# --- Europa League trophy ---------------------------------------------------
# Measured from the 2000x1125 source: the trophy occupies x 1216-1384,
# y 180-936, with a mirrored reflection below its base that must not come with
# it.
#
# This crop is deliberately generous. Two attempts to tighten it in order to
# exclude the source's own beams both took the cup in too far and clipped the
# flared rim and the base ring. Do not narrow it again: the surround is dealt
# with per surface instead — the card lets it blend into a ground of the same
# colour, and the receipt clips it to the cup's outline.
TROPHY_CROP = (1180, 168, 1436, 864)

# No colour key here, deliberately. Two earlier attempts failed for the same
# reason: the trophy is lit by the set's orange light, so it is neither
# desaturated (a saturation key shredded its middle) nor reliably brighter than
# the glow behind it (a luminance key kept the glow and the beams). The
# discriminators genuinely overlap.
#
# They do not need to be separated. The card this lands on is the same dark
# orange as the photograph's own background, so the crop is composited whole
# and only its edges are feathered -- what survives around the trophy reads as
# the card, not as a rectangle.
TROPHY_WIDTH = 420
TROPHY_FEATHER = 0.16   # fraction of each edge dissolved to transparent


def build_trophy(source: Path, out: Path) -> None:
    im = Image.open(source).convert("RGB").crop(TROPHY_CROP)
    w, h = im.size

    fx, fy = int(w * TROPHY_FEATHER), int(h * TROPHY_FEATHER)
    alpha = Image.new("L", (w, h), 255)
    px = alpha.load()
    for x in range(w):
        ax = 255 if fx == 0 else min(255, int(255 * min(x, w - 1 - x) / fx))
        for y in range(h):
            ay = 255 if fy == 0 else min(255, int(255 * min(y, h - 1 - y) / fy))
            px[x, y] = min(ax, ay)

    im = im.convert("RGBA")
    im.putalpha(alpha)

    height = round(h * TROPHY_WIDTH / w)
    im = im.resize((TROPHY_WIDTH, height), Image.LANCZOS)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=WEBP_QUALITY, alpha_quality=WEBP_ALPHA_QUALITY, method=WEBP_METHOD)
    print(f"wrote {out}  {im.width}x{im.height}  {out.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
