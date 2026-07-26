#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow"]
# ///
"""Pixel-level image comparison for the staging -> target screenshot promotion
workflow (see capture_screenshots.mjs's sync_staging_to_target step).

Deliberately compares DECODED PIXELS, not file bytes -- two PNG encodes of
the identical image can differ byte-for-byte (different compression
settings/optimize flags/encoder version) while being visually and
pixel-for-pixel identical; a byte/hash comparison would spuriously treat
those as a real change and promote a no-op. See
test_compare_images.py::check_different_bytes_same_pixels_pngs_match for the
regression test protecting exactly this.

Usable as a library (`from compare_images import images_match`) or as a CLI:
  compare_images.py <a> <b>
exits 0 if the images match, 1 if they differ, 2 on a usage/read error.

Run: uv run --no-project --with pillow compare_images.py <a> <b>
"""
import sys
from pathlib import Path

from PIL import Image, ImageSequence


def _frames(path: Path):
    """Yield each frame of an image (static images yield exactly one), each
    normalized to RGBA so a fully-transparent pixel compares equal
    regardless of what garbage its RGB channels hold."""
    with Image.open(path) as im:
        for frame in ImageSequence.Iterator(im):
            yield frame.convert("RGBA").copy()


def images_match(path_a, path_b) -> bool:
    """True if path_a and path_b decode to exactly the same pixels, frame by
    frame (animated GIFs included). False if either file is missing/unreadable,
    dimensions differ, frame counts differ, or any single pixel differs."""
    path_a, path_b = Path(path_a), Path(path_b)
    if not path_a.is_file() or not path_b.is_file():
        return False
    try:
        frames_a = list(_frames(path_a))
        frames_b = list(_frames(path_b))
    except Exception:
        return False
    if len(frames_a) != len(frames_b):
        return False
    for fa, fb in zip(frames_a, frames_b):
        if fa.size != fb.size:
            return False
        if fa.tobytes() != fb.tobytes():
            return False
    return True


def main(argv) -> int:
    if len(argv) != 3:
        print("usage: compare_images.py <a> <b>", file=sys.stderr)
        return 2
    a, b = Path(argv[1]), Path(argv[2])
    if not a.is_file():
        print(f"compare_images: not found: {a}", file=sys.stderr)
        return 2
    if not b.is_file():
        print(f"compare_images: not found: {b}", file=sys.stderr)
        return 2
    match = images_match(a, b)
    print("MATCH" if match else "DIFFER")
    return 0 if match else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
