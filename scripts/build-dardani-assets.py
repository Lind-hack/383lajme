#!/usr/bin/env python3
"""Build the web versions of the Dardani mascot and the typed manifest.

Reads dardani-assets/asset-map.json and the full-quality downloads in
dardani-assets/files/ (fetch them first with `node dardani-assets/download-assets.mjs`;
they are gitignored). Writes:

  public/mascot/dardani-<name>.webp          every still, trimmed and resized
  public/mascot/dardani-<name>.webm          every loop, VP9 with alpha, 480px wide
  public/mascot/dardani-<name>.mp4           every loop, H.264, 480px wide
  public/mascot/dardani-<name>-poster.webp   first frame of each loop, with alpha
  lib/dardani-assets.ts                      names -> web paths, sizes, alt text

Stills are cut out on transparent backgrounds with wide empty margins, so the
alpha bounding box is trimmed first, then the result is fitted to twice the
largest size it is shown at: faces and avatars sit in 34-63px circles (160px),
everything else is a full-body pose or card art shown at most ~240px tall (480px).

The MP4 exists for Safari, which cannot play VP9 alpha. The supplied MP4s are
flattened onto #F4EFEA, a shade off the site's #F9F6F1 cream, which leaves a
visible box behind Dardani. So the MP4 is rebuilt from the transparent WebM
composited onto the site cream instead: same frames, invisible edges.

The poster is the loop's own first frame rather than the separate still: the
stills are framed differently, and a poster that does not match frame one
jumps when the video starts. Every loop starts and ends on the same frame, so
frame one is also the right reduced-motion image. Loops are never trimmed.

    python scripts/build-dardani-assets.py
    python scripts/build-dardani-assets.py --only headbob   # re-encode one file;
                                                            # everything else is read back

Pure Pillow plus the ffmpeg CLI, matching the other build-*-asset.py scripts.
"""

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "dardani-assets"
OUT = ROOT / "public" / "mascot"
MODULE = ROOT / "lib" / "dardani-assets.ts"

CREAM = "0xF9F6F1"
LOOP_WIDTH = 480
# headbob only ever plays inside the navbar pill's face circle (~32px) and loads
# on every page: at 480px it would ship several times the pixels it can show.
LOOP_WIDTHS = {"headbob": 160}
# Generated video glitches, frame index -> the clean neighbour that replaces it.
# headbob: the right eye flashes a blown-out white highlight or a ghosted pupil
# on these frames (the pill plays it at 32px, where that reads as the eye
# twitching), and 84-86 are a dark half-formed eye mid-blink, so the lid snaps
# open from 83 to 87 instead. Timing and the loop point are unchanged.
FRAME_REPAIRS = {
    "headbob": {0: 1, 2: 1, 3: 4, 20: 19, 30: 31, 33: 32, 34: 35, 36: 35,
                63: 62, 64: 66, 65: 66, 84: 87, 85: 87, 86: 87, 88: 87, 90: 89},
}
FACE_MAX = 160
POSE_MAX_H = 480
POSE_MAX_W = 512
PHOTO_MAX_W = 720
ALPHA_FLOOR = 8  # ignore near-invisible fringe pixels when trimming
ALPHA_FLOOR_LOOP = 16  # below this a loop pixel is scaling haze, not Dardani
TRIM_PAD = 2


def name_of(file_path: str) -> str:
    stem = Path(file_path).stem  # dardani-<name>
    return stem[len("dardani-"):]


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"ffmpeg failed: {' '.join(cmd)}\n{result.stderr[-2000:]}")


def fit(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    scale = min(max_w / img.width, max_h / img.height, 1.0)
    if scale >= 1.0:
        return img
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    return img.resize(size, Image.LANCZOS)


def build_still(src: Path, name: str, has_alpha: bool):
    img = Image.open(src)
    dest = OUT / f"dardani-{name}.webp"
    if has_alpha:
        img = img.convert("RGBA")
        mask = img.getchannel("A").point(lambda a: 255 if a > ALPHA_FLOOR else 0)
        box = mask.getbbox()
        if box:
            l, t, r, b = box
            img = img.crop((max(0, l - TRIM_PAD), max(0, t - TRIM_PAD),
                            min(img.width, r + TRIM_PAD), min(img.height, b + TRIM_PAD)))
        is_face = name.startswith(("avatar-", "face-"))
        img = fit(img, FACE_MAX, FACE_MAX) if is_face else fit(img, POSE_MAX_W, POSE_MAX_H)
        img.save(dest, "WEBP", quality=86, method=6, exact=False)
    else:
        img = fit(img.convert("RGB"), PHOTO_MAX_W, PHOTO_MAX_W)
        img.save(dest, "WEBP", quality=82, method=6)
    return img.width, img.height


def build_loop(webm_src: Path, name: str):
    with tempfile.TemporaryDirectory() as work:
        return _build_loop(webm_src, name, Path(work))


def repaired_frames(webm_src: Path, name: str, work: Path) -> list:
    """Decode the loop to PNG frames and overwrite each broken one with its clean neighbour.

    Returns ffmpeg input arguments that read the repaired sequence at the source rate.
    """
    rate = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=r_frame_rate",
         "-of", "csv=p=0", str(webm_src)], capture_output=True, text=True).stdout.strip()
    run(["ffmpeg", "-v", "error", "-y", "-c:v", "libvpx-vp9", "-i", str(webm_src),
         "-start_number", "0", str(work / "f%04d.png")])
    for bad, good in FRAME_REPAIRS[name].items():
        shutil.copyfile(work / f"f{good:04d}.png", work / f"f{bad:04d}.png")
    return ["-framerate", rate, "-start_number", "0", "-i", str(work / "f%04d.png")]


def build_stack(webm_src: Path, name: str):
    """The loop as a stacked-alpha H.264 MP4: colour on top, alpha as grey below.

    This is what the site plays. A VP9 WebM keeps its alpha only when the
    browser's decoder honours it, and many Windows machines with hardware video
    decode drop it, painting the hidden pixels - a white square behind Dardani.
    An ordinary MP4 has no alpha to lose: components/dardani/dardani-loop.tsx
    draws both halves into a WebGL canvas and puts the mask back. Colour is
    premultiplied so the fully transparent area encodes as flat black.
    """
    with tempfile.TemporaryDirectory() as work:
        if name in FRAME_REPAIRS:
            decode = ["ffmpeg", "-v", "error", "-y"] + repaired_frames(webm_src, name, Path(work))
        else:
            decode = ["ffmpeg", "-v", "error", "-y", "-c:v", "libvpx-vp9", "-i", str(webm_src)]
        width = LOOP_WIDTHS.get(name, LOOP_WIDTH)
        graph = (
            f"[0:v]scale={width}:-2:flags=lanczos,format=yuva444p,"
            f"lutyuv=a='if(lt(val,{ALPHA_FLOOR_LOOP}),0,val)',split[c][m];"
            "[c]premultiply=inplace=1,format=yuv444p[col];"
            "[m]alphaextract,format=yuv444p[mask];"
            "[col][mask]vstack=inputs=2,format=yuv420p"
        )
        run(decode + ["-filter_complex", graph, "-an", "-c:v", "libx264", "-crf", "22",
                      "-preset", "slow", "-profile:v", "high", "-movflags", "+faststart",
                      str(OUT / f"dardani-{name}-stack.mp4")])


def _build_loop(webm_src: Path, name: str, work: Path):
    scale = f"scale={LOOP_WIDTHS.get(name, LOOP_WIDTH)}:-2:flags=lanczos"
    # Downscaling leaves a haze of alpha 1-15 across the empty frame; over the
    # cream page it reads as a faint box behind Dardani (and a drop-shadow makes
    # it plain). The sources are clean zeros there, so snap the haze back to 0.
    clean = f"{scale},lutyuv=a='if(lt(val,{ALPHA_FLOOR_LOOP}),0,val)'"
    webm = OUT / f"dardani-{name}.webm"
    mp4 = OUT / f"dardani-{name}.mp4"
    poster = OUT / f"dardani-{name}-poster.webp"
    if name in FRAME_REPAIRS:
        decode = ["ffmpeg", "-v", "error", "-y"] + repaired_frames(webm_src, name, work)
    else:
        # libvpx-vp9 must decode the input for its alpha plane to survive.
        decode = ["ffmpeg", "-v", "error", "-y", "-c:v", "libvpx-vp9", "-i", str(webm_src)]

    run(decode + ["-vf", clean, "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                  "-b:v", "0", "-crf", "34", "-row-mt", "1", str(webm)])

    run(decode + ["-f", "lavfi", "-i", f"color=c={CREAM}:s=16x16",
                  "-filter_complex",
                  f"[0:v]{scale}[fg];[1:v][fg]scale2ref[bg][fg2];"
                  f"[bg][fg2]overlay=shortest=1:format=auto,format=yuv420p",
                  "-an", "-c:v", "libx264", "-crf", "26", "-preset", "slow",
                  "-movflags", "+faststart", str(mp4)])

    frame = work / "poster.png"
    run(decode + ["-vf", clean, "-frames:v", "1", str(frame)])
    img = Image.open(frame).convert("RGBA")
    img.save(poster, "WEBP", quality=86, method=6, exact=False)
    return img.width, img.height


def ts_string(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def main():
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg is not on PATH")
    data = json.loads((PACK / "asset-map.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)

    only = set(a for a in sys.argv[sys.argv.index("--only") + 1:] if not a.startswith("--")) if "--only" in sys.argv else None
    # Only (re)build the stacked-alpha MP4s; everything else is read back.
    stack_only = "--stack-only" in sys.argv

    stills, loops = {}, {}
    for asset in data["assets"]:
        name = name_of(asset["file"])
        # Files outside --only are not re-encoded; their sizes are read back from
        # what is already in public/mascot so the manifest stays complete.
        skip = only is not None and name not in only
        if asset["type"] == "still":
            src = PACK / asset["file"]
            has_alpha = "stills-with-background" not in asset["file"]
            if skip:
                w, h = Image.open(OUT / f"dardani-{name}.webp").size
            else:
                w, h = build_still(src, name, has_alpha)
            stills[name] = {
                "src": f"/mascot/dardani-{name}.webp",
                "width": w,
                "height": h,
                "alt": asset.get("alt_sq") or "",
                "copy": asset.get("copy_sq") or None,
            }
            print(f"still {name:22} {w}x{h}")
        elif asset["type"] == "loop":
            src = PACK / asset["file_alpha"]
            if skip or stack_only:
                w, h = Image.open(OUT / f"dardani-{name}-poster.webp").size
            else:
                w, h = build_loop(src, name)
            if not skip:
                build_stack(src, name)
            loops[name] = {
                "webm": f"/mascot/dardani-{name}.webm",
                "mp4": f"/mascot/dardani-{name}.mp4",
                "stack": f"/mascot/dardani-{name}-stack.mp4",
                "poster": f"/mascot/dardani-{name}-poster.webp",
                "width": w,
                "height": h,
                "alt": asset.get("alt_sq") or "",
            }
            print(f"loop  {name:22} {w}x{h}")

    still_names = " | ".join(ts_string(n) for n in sorted(stills))
    loop_names = " | ".join(ts_string(n) for n in sorted(loops))

    def entries(table, keys):
        lines = []
        for name in sorted(table):
            row = table[name]
            fields = ", ".join(f"{k}: {ts_string(row[k])}" for k in keys)
            lines.append(f"  {ts_string(name)}: {{ {fields} }},")
        return "\n".join(lines)

    MODULE.write_text(
        "// Generated by scripts/build-dardani-assets.py from dardani-assets/asset-map.json.\n"
        "// Do not edit by hand: re-run the script. Components look the mascot up by\n"
        "// name here and never hard-code a /mascot path.\n\n"
        f"export type DardaniStillName = {still_names};\n\n"
        f"export type DardaniLoopName = {loop_names};\n\n"
        "export type DardaniStill = {\n"
        "  src: string;\n  width: number;\n  height: number;\n"
        "  /** Albanian alt text. */\n  alt: string;\n"
        "  /** Suggested Albanian copy for the surface it belongs to, when the map gives one. */\n"
        "  copy: string | null;\n};\n\n"
        "export type DardaniLoop = {\n"
        "  webm: string;\n  mp4: string;\n"
        "  /** Stacked-alpha MP4 (colour above, alpha below) that the site plays through WebGL. */\n"
        "  stack: string;\n"
        "  /** The loop's own first frame: the poster, and the reduced-motion image. */\n"
        "  poster: string;\n  width: number;\n  height: number;\n  alt: string;\n};\n\n"
        "export const DARDANI_STILLS: Record<DardaniStillName, DardaniStill> = {\n"
        f"{entries(stills, ['src', 'width', 'height', 'alt', 'copy'])}\n}};\n\n"
        "export const DARDANI_LOOPS: Record<DardaniLoopName, DardaniLoop> = {\n"
        f"{entries(loops, ['webm', 'mp4', 'stack', 'poster', 'width', 'height', 'alt'])}\n}};\n",
        encoding="utf-8",
    )
    print(f"\n{len(stills)} stills, {len(loops)} loops -> {OUT.relative_to(ROOT)}; {MODULE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
