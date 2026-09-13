#!/usr/bin/env python3
"""Build the basketball competition ornaments for the Tregu market cards.

One subject, keyed out of the source photograph:

  ball    hue/saturation key, morphologically closed. The ball is the only
          bright, strongly-saturated orange object in the frame, so it keys
          cleanly -- except that its own black seams cut the mask into six
          pieces (measured: 4952/3059/2958/1424/1242 px blobs). A close
          (dilate-then-erode) welds them back together before the largest
          component is taken, and interior holes are filled afterwards so the
          seams come back as image, not as transparency.

The court itself is NOT built here. The reference's floor is dark maroon under
stage light and carries the ball's own reflection across it, so a crop of it is
neither honey parquet nor tileable -- it was tried and discarded. The parquet is
authored in CSS instead (see .tregu-trade-celebration[data-finish="parquet"]),
which tiles exactly, weighs nothing, and can be themed per competition.

The source photograph is not committed; pass it with --source. Only the
generated .webp files are checked in. Same rule as
build-ucl-stadium-asset.py, and the same reason: we hold no redistribution
right to the reference.

    python scripts/build-basketball-asset.py --source path/to/reference.png

Pure Pillow, matching build-ucl-stadium-asset.py -- numpy is unusable in the
venv on this machine (cp312 binaries under a cp311 interpreter).
"""

import argparse
import colorsys
import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

# --- Ball -------------------------------------------------------------------
# Hue window, saturation and value floors measured off the 518x300 reference by
# sweeping both floors and scoring the resulting matte by fill ratio. These
# values return a blob of 183x174 filling 0.785 of its bounding box -- pi/4, a
# disc to three decimal places, which is the check that the matte is the ball's
# real silhouette rather than a chewed subset of it.
#
# Saturation is the discriminator that matters, not value: the ball's shaded
# left flank runs down to V=0.24, so an earlier V>=0.52 floor ate it and took
# the swoosh with it. The crowd behind is the same hue family but washes out
# below S=0.55, and the gold floor stripe is yellower (H>40).
BALL_HUE = (8, 40)
BALL_SAT_FLOOR = 0.55
BALL_VAL_FLOOR = 0.22

# The ball rests at y~205 and its mirrored reflection starts immediately below.
# Nothing above this line belongs to the reflection, so cutting the search here
# is what stops the close from welding the two into one blob -- cheaper and far
# more predictable than trying to separate them afterwards.
BALL_SEARCH_FLOOR = 212

# Close radius. The widest seam on the ball measures 7px at this resolution;
# 5 dilate+erode passes of a 3x3 max/min filter closes 10px and still does not
# bridge the ~24px gap to the reflection below the contact point.
BALL_CLOSE = 5

# Feather. One pixel of blur on the matte only -- enough to kill the keyed
# stair-step without eating the ball's silhouette.
BALL_FEATHER = 1.1

# 380px covers a ~190 CSS px ornament at 2x. The ball measures ~175px in the
# source, so this is a 2.2x upsample: acceptable only because the ornament
# renders under 1 and is never the sharp subject of the card. Do not raise it
# expecting more detail -- there is none in the source to recover.
BALL_WIDTH = 380

WEBP_QUALITY = 78
WEBP_ALPHA_QUALITY = 78
WEBP_METHOD = 6


def _keyed(rgb):
    r, g, b = rgb
    hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    deg = hue * 360
    return BALL_HUE[0] <= deg <= BALL_HUE[1] and sat >= BALL_SAT_FLOOR and val >= BALL_VAL_FLOOR


def _largest_component(mask):
    """Keep only the biggest blob: drops the reflection and any stray highlight."""
    w, h = mask.size
    px = mask.load()
    seen = [[False] * w for _ in range(h)]
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] and not seen[y0][x0]:
                queue = deque([(x0, y0)])
                seen[y0][x0] = True
                points = []
                while queue:
                    x, y = queue.popleft()
                    points.append((x, y))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            queue.append((nx, ny))
                if len(points) > len(best):
                    best = points
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for x, y in best:
        op[x, y] = 255
    return out


def _fill_holes(mask):
    """Flood the outside from the border; whatever stays unflooded is interior."""
    w, h = mask.size
    px = mask.load()
    outside = [[False] * w for _ in range(h)]
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not px[x, y] and not outside[y][x]:
                outside[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not px[x, y] and not outside[y][x]:
                outside[y][x] = True
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not px[nx, ny] and not outside[ny][nx]:
                outside[ny][nx] = True
                queue.append((nx, ny))
    out = mask.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if not outside[y][x]:
                op[x, y] = 255
    return out


def _close_to_disc(mask):
    """Restore the rim the key could not reach, using the ball's own geometry.

    The keyed blob measures pi/4 fill, i.e. it is already a disc -- but its
    topmost sliver sits against the dark crowd and keys a few pixels short,
    which reads as a bite taken out of the silhouette. A sphere's outline *is*
    a circle, so the circle implied by the blob's own area and centroid is a
    reconstruction of the real edge rather than a geometric stand-in for an
    organic one. Unioned, never substituted: where the key found the edge, the
    key wins.

    The radius is pulled in by one pixel so the union cannot annex a ring of
    background the key deliberately rejected.
    """
    w, h = mask.size
    px = mask.load()
    points = [(x, y) for y in range(h) for x in range(w) if px[x, y]]
    if not points:
        return mask
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    radius = math.sqrt(len(points) / math.pi) - 1.0

    out = mask.copy()
    op = out.load()
    r2 = radius * radius
    top = int(max(0, cy - radius - 2))
    bottom = int(min(h, cy + radius + 2))
    for y in range(top, bottom):
        dy2 = (y - cy) ** 2
        if dy2 > r2:
            continue
        span = math.sqrt(r2 - dy2)
        for x in range(int(max(0, cx - span)), int(min(w, cx + span + 1))):
            op[x, y] = 255
    return out


def build_ball(source: Path, out: Path) -> None:
    im = Image.open(source).convert("RGB")
    w, h = im.size
    px = im.load()

    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(min(h, BALL_SEARCH_FLOOR)):
        for x in range(w):
            if _keyed(px[x, y]):
                mp[x, y] = 255

    for _ in range(BALL_CLOSE):
        mask = mask.filter(ImageFilter.MaxFilter(3))
    for _ in range(BALL_CLOSE):
        mask = mask.filter(ImageFilter.MinFilter(3))

    mask = _largest_component(mask)
    mask = _fill_holes(mask)
    mask = _close_to_disc(mask)

    box = mask.getbbox()
    if not box:
        raise SystemExit("ball key produced an empty matte - re-measure BALL_* against the source")

    mask = mask.filter(ImageFilter.GaussianBlur(BALL_FEATHER))

    im = im.convert("RGBA")
    im.putalpha(mask)
    im = im.crop(box)

    height = round(im.height * BALL_WIDTH / im.width)
    im = im.resize((BALL_WIDTH, height), Image.LANCZOS)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=WEBP_QUALITY, alpha_quality=WEBP_ALPHA_QUALITY, method=WEBP_METHOD)
    print(f"wrote {out}  {im.width}x{im.height}  {out.stat().st_size / 1024:.1f} KB  (source bbox {box})")



def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True, type=Path, help="reference photograph")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    images = Path(__file__).resolve().parent.parent / "public/images/tregu"
    build_ball(args.source, args.out or images / "basketball-ball-v1.webp")


if __name__ == "__main__":
    main()
