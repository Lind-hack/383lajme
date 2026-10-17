#!/usr/bin/env python3
"""Build the video edition's fixed library of transitions, sounds and music
(once, on a machine with ffmpeg), for scripts/video_edition_render.py:

    python scripts/video_edition_assets.py --burns D:/transitions --sounds D:/383-video-assets/raw --out D:/383-video-assets/library

- burns/: Lind's film-burn transitions, upright (1080x1920, centre crop),
  30 fps, silent, each with its own sound beside it and the moment it is
  brightest, so a cut can land under the flash.
- sfx/: the sound effects, named <kind>-<n> (whoosh, swish, riser, swell,
  impact, boom, pop, shutter, tick), trimmed of silence and peak-normalised.
- music/: the beds, named <mood>-<n> (tense, serious, calm, bright), 48 kHz.
- library.json: what is there, with durations; the renderer reads only this.

Then copy the folder to /opt/data/video-edition/library on the VPS.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SFX_KINDS = ("whoosh", "swish", "riser", "swell", "impact", "boom", "pop", "shutter", "tick")
MOODS = ("tense", "serious", "calm", "bright")
VERSION = 1


def run(*args: str) -> str:
    done = subprocess.run(args, capture_output=True, text=True, check=False)
    if done.returncode:
        raise RuntimeError(f"{args[0]} failed: {done.stderr[-800:]}")
    return done.stdout + done.stderr


def duration(path: Path) -> float:
    return round(float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)).strip()), 3)


def brightest(path: Path) -> float:
    """Seconds into the clip where it is brightest (the flash a cut hides under)."""
    out = run("ffmpeg", "-hide_banner", "-i", str(path), "-vf", "scale=96:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-")
    times = [float(t) for t in re.findall(r"pts_time:([\d.]+)", out)]
    lumas = [float(v) for v in re.findall(r"YAVG=([\d.]+)", out)]
    if not times or len(times) != len(lumas):
        return 0.0
    return round(times[max(range(len(lumas)), key=lumas.__getitem__)], 3)


def has_audio(path: Path) -> bool:
    out = run("ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(path))
    if not out.strip():
        return False
    vol = run("ffmpeg", "-hide_banner", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-")
    m = re.search(r"max_volume: (-?[\d.]+) dB", vol)
    return bool(m) and float(m.group(1)) > -60


def build_burns(src: Path, out: Path) -> list[dict]:
    out.mkdir(parents=True, exist_ok=True)
    items = []
    files = sorted(src.glob("*.mp4"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0))
    for n, f in enumerate(files, 1):
        name = f"burn{n:02d}"
        video = out / f"{name}.mp4"
        # Centre crop of a landscape frame to upright, 1080x1920, 30 fps, no sound.
        run("ffmpeg", "-v", "error", "-y", "-i", str(f), "-vf", "crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,fps=30,format=yuv420p",
            "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", str(video))
        item = {"file": f"burns/{name}.mp4", "duration": duration(video), "peak": brightest(video), "sound": ""}
        if has_audio(f):
            run("ffmpeg", "-v", "error", "-y", "-i", str(f), "-vn", "-ac", "2", "-ar", "48000", "-af", "loudnorm=I=-16:TP=-1.5", str(out / f"{name}.wav"))
            item["sound"] = f"burns/{name}.wav"
        items.append(item)
        print(f"burn {name}: {item['duration']}s, brightest at {item['peak']}s, sound {bool(item['sound'])}")
    return items


def build_sounds(src: Path, out: Path) -> tuple[dict, dict]:
    (out / "sfx").mkdir(parents=True, exist_ok=True)
    (out / "music").mkdir(parents=True, exist_ok=True)
    sfx: dict[str, list[dict]] = {k: [] for k in SFX_KINDS}
    music: dict[str, list[dict]] = {m: [] for m in MOODS}
    for f in sorted(src.iterdir()):
        stem = f.stem.lower()
        kind = re.sub(r"-\d+$", "", stem)
        if kind in sfx:
            dest = out / "sfx" / f"{stem}.wav"
            # Silence trimmed from the start (a hit must land on its frame), peaks at -1 dBFS.
            run("ffmpeg", "-v", "error", "-y", "-i", str(f), "-ac", "2", "-ar", "48000",
                "-af", "silenceremove=start_periods=1:start_threshold=-50dB,dynaudnorm=p=0.89:m=100:s=12" if kind != "riser" and kind != "swell"
                else "dynaudnorm=p=0.89:m=100:s=12", str(dest))
            sfx[kind].append({"file": f"sfx/{dest.name}", "duration": duration(dest)})
        elif kind in music:
            dest = out / "music" / f"{stem}.m4a"
            run("ffmpeg", "-v", "error", "-y", "-i", str(f), "-ac", "2", "-ar", "48000", "-af", "loudnorm=I=-18:TP=-2", "-c:a", "aac", "-b:a", "192k", str(dest))
            music[kind].append({"file": f"music/{dest.name}", "duration": duration(dest)})
    missing = [k for k, v in {**sfx, **music}.items() if not v]
    if missing:
        print(f"warning: nothing for {', '.join(missing)}", file=sys.stderr)
    return sfx, music


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--burns", type=Path, required=True)
    ap.add_argument("--sounds", type=Path, required=True)
    ap.add_argument("--fonts", type=Path, help="folder with the woff2 fonts to copy into fonts/")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    burns = build_burns(a.burns, a.out / "burns")
    sfx, music = build_sounds(a.sounds, a.out)
    if a.fonts:
        shutil.copytree(a.fonts, a.out / "fonts", dirs_exist_ok=True)
    (a.out / "library.json").write_text(json.dumps({"version": VERSION, "burns": burns, "sfx": sfx, "music": music}, indent=1), encoding="utf-8")
    print(f"library: {len(burns)} burns, {sum(map(len, sfx.values()))} sounds, {sum(map(len, music.values()))} beds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
