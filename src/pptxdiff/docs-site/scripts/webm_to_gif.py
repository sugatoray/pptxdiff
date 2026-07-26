#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow"]
# ///
"""Assemble a PNG frame sequence into an animated GIF.

Split out from capture_screenshots.mjs because the Playwright-bundled ffmpeg
used to decode a recorded .webm (see that script) has no gif muxer/encoder or
fps/palettegen filters in this project's sandbox -- it can only decode +
scale + emit a raw PNG sequence. Pillow does the actual GIF encoding, no
ffmpeg involved. See docs/.scrolls/WISDOM.md ("capturing real
screenshots/GIFs" addendum) for how this was discovered.

Run: uv run --no-project --with pillow webm_to_gif.py <frames_dir> <out.gif> <fps>
"""
import sys
from pathlib import Path

from PIL import Image


def is_blank(img: Image.Image) -> bool:
    """True if a frame is (near-)uniformly white -- Playwright's video
    recording starts at context creation, before the page's first paint, so
    the opening frames of any recording are a blank canvas rather than app
    content."""
    data = img.resize((32, 20)).convert("L").tobytes()
    return (sum(data) / len(data)) > 250


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: webm_to_gif.py <frames_dir> <out.gif> <fps>", file=sys.stderr)
        return 2
    frames_dir, out_path, fps = Path(sys.argv[1]), Path(sys.argv[2]), float(sys.argv[3])
    frames = sorted(frames_dir.glob("frame-*.png"))
    if not frames:
        print(f"no frames found in {frames_dir}", file=sys.stderr)
        return 1
    images = [Image.open(f).convert("RGB") for f in frames]

    start = 0
    while start < len(images) - 1 and is_blank(images[start]):
        start += 1
    if start:
        print(f"dropped {start} blank leading frame(s) (pre-first-paint)")
        images = images[start:]

    images[0].save(
        out_path,
        save_all=True,
        append_images=images[1:],
        duration=round(1000 / fps),
        loop=0,
        optimize=True,
    )
    print(f"wrote {out_path} ({len(images)} frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
