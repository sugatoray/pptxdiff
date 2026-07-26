#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow"]
# ///
"""Red/Green regression check for compare_images.py's images_match().

Pure unit tests against synthetic Pillow-generated fixtures -- no Playwright,
no server, no network, so this runs in a couple seconds and can gate every
change to the comparison logic that decides whether a staged screenshot gets
promoted over a committed one (see sync_staging_to_target in
capture_screenshots.mjs).

Run: uv run src/pptxdiff/docs-site/scripts/test_compare_images.py
(or: python3 test_compare_images.py, if pillow is already installed)
"""
import sys
import tempfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_images import images_match  # noqa: E402


def _save_png(path, color, size=(20, 16)):
    Image.new("RGB", size, color).save(path)


def _save_gif(path, frame_colors, size=(20, 16), duration=100):
    frames = [Image.new("RGB", size, c) for c in frame_colors]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=duration, loop=0)


def check_identical_pngs_match(tmp):
    a, b = tmp / "a.png", tmp / "b.png"
    _save_png(a, (200, 50, 50))
    _save_png(b, (200, 50, 50))
    assert images_match(a, b) is True, "pixel-identical PNGs should match"
    print("  [OK] identical PNGs match")


def check_different_pixel_pngs_mismatch(tmp):
    a, b = tmp / "a.png", tmp / "b.png"
    _save_png(a, (200, 50, 50))
    _save_png(b, (200, 50, 51))  # single-channel, single-value difference
    assert images_match(a, b) is False, "even a 1-value pixel difference should mismatch"
    print("  [OK] a single differing pixel value mismatches")


def check_different_size_pngs_mismatch(tmp):
    a, b = tmp / "a.png", tmp / "b.png"
    _save_png(a, (10, 10, 10), size=(20, 16))
    _save_png(b, (10, 10, 10), size=(20, 17))
    assert images_match(a, b) is False, "different dimensions must never match"
    print("  [OK] different-size PNGs mismatch")


def check_different_bytes_same_pixels_pngs_match(tmp):
    """The whole point of pixel-level (not byte-level) comparison: two PNG
    encodes of the same pixels, saved with different settings, must still
    match -- this is exactly the PNG-encoder-nondeterminism case that
    motivated pixel comparison over a file hash/byte diff."""
    a, b = tmp / "a.png", tmp / "b.png"
    img = Image.new("RGB", (20, 16), (80, 160, 240))
    img.save(a, optimize=False)
    img.save(b, optimize=True, compress_level=9)
    assert a.stat().st_size != b.stat().st_size or a.read_bytes() != b.read_bytes(), \
        "test setup should actually produce different bytes"
    assert images_match(a, b) is True, "same pixels, different encoding, must still match"
    print("  [OK] same pixels with different PNG encoding still match")


def check_identical_gifs_match(tmp):
    a, b = tmp / "a.gif", tmp / "b.gif"
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    _save_gif(a, colors)
    _save_gif(b, colors)
    assert images_match(a, b) is True, "identical animated GIFs should match"
    print("  [OK] identical GIFs match")


def check_different_frame_count_gifs_mismatch(tmp):
    a, b = tmp / "a.gif", tmp / "b.gif"
    _save_gif(a, [(255, 0, 0), (0, 255, 0), (0, 0, 255)])
    _save_gif(b, [(255, 0, 0), (0, 255, 0)])
    assert images_match(a, b) is False, "different frame counts must mismatch"
    print("  [OK] different-frame-count GIFs mismatch")


def check_different_frame_content_gifs_mismatch(tmp):
    a, b = tmp / "a.gif", tmp / "b.gif"
    _save_gif(a, [(255, 0, 0), (0, 255, 0), (0, 0, 255)])
    _save_gif(b, [(255, 0, 0), (0, 254, 0), (0, 0, 255)])  # middle frame off by one
    assert images_match(a, b) is False, "a differing middle frame must mismatch"
    print("  [OK] one differing frame among matching others mismatches")


def check_missing_file_mismatches_without_crashing(tmp):
    a, b = tmp / "a.png", tmp / "missing.png"
    _save_png(a, (1, 2, 3))
    assert images_match(a, b) is False, "a missing comparison target should mismatch, not match"
    print("  [OK] missing file mismatches (treated as 'no target yet')")


def main():
    checks = [
        check_identical_pngs_match,
        check_different_pixel_pngs_mismatch,
        check_different_size_pngs_mismatch,
        check_different_bytes_same_pixels_pngs_match,
        check_identical_gifs_match,
        check_different_frame_count_gifs_mismatch,
        check_different_frame_content_gifs_mismatch,
        check_missing_file_mismatches_without_crashing,
    ]
    failures = []
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        for check in checks:
            try:
                check(tmp)
            except AssertionError as e:
                failures.append(f"{check.__name__}: {e}")
                print(f"  [FAIL] {check.__name__}: {e}")

    print()
    if failures:
        print(f"compare_images check: {len(checks) - len(failures)}/{len(checks)} passed")
        print("FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"compare_images check: {len(checks)}/{len(checks)} passed")
    print("All compare_images checks passed (GREEN).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
