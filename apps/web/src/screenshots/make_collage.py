#!/usr/bin/env python3
"""
Create a 2x2 collage from PNG screenshots in this folder.

Usage (run from anywhere):
  python make_collage.py

Optional args:
  --rows 2 --cols 2           Grid layout (defaults to 2x2)
  --gap 16                    Gap between tiles in pixels (default: 16)
  --margin 0                  Outer margin around the grid (default: 0)
  --background "#ffffff"       Background color (default: white)
  --pattern "*.png"            Glob for input images (default: PNGs)
  --output "collage.png"       Output filename (default: collage.png)
  --max-images 4              Max images to include (default: 4)

The script searches for images in the same directory as this script by default.
"""

from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path
import re
from typing import List, Tuple

from PIL import Image, ImageColor, ImageOps, ImageDraw, ImageFont
import math


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a simple grid collage from images.")
    parser.add_argument("--input-dir", type=str, default=None, help="Directory to read images from. Defaults to this script's directory.")
    parser.add_argument("--pattern", type=str, default="screenshot_*.png", help="Glob pattern to select images (default: screenshot_*.png)")
    parser.add_argument("--rows", type=int, default=2, help="Number of grid rows (default: 2)")
    parser.add_argument("--cols", type=int, default=2, help="Number of grid columns (default: 2)")
    parser.add_argument("--gap", type=int, default=16, help="Gap between tiles in pixels (default: 16)")
    parser.add_argument("--margin", type=int, default=0, help="Outer margin (pixels) around the collage (default: 0)")
    parser.add_argument("--margin-top", dest="margin_top", type=int, default=None, help="Top margin (overrides --margin if set)")
    parser.add_argument("--margin-right", dest="margin_right", type=int, default=None, help="Right margin (overrides --margin if set)")
    parser.add_argument("--margin-bottom", dest="margin_bottom", type=int, default=None, help="Bottom margin (overrides --margin if set)")
    parser.add_argument("--margin-left", dest="margin_left", type=int, default=None, help="Left margin (overrides --margin if set)")
    parser.add_argument("--background", type=str, default="#ffffff", help="Background color (e.g., #ffffff) (default: white)")
    parser.add_argument("--output", type=str, default="collage.png", help="Output file name (default: collage.png)")
    parser.add_argument("--max-images", type=int, default=4, help="Maximum number of images to include (default: 4)")
    # Label options
    parser.add_argument("--labels", dest="labels", action="store_true", default=True, help="Draw numeric labels on each tile (default: on)")
    parser.add_argument("--no-labels", dest="labels", action="store_false", help="Disable labels")
    parser.add_argument("--label-position", type=str, default="top-left", choices=["top-left", "top-right", "bottom-left", "bottom-right"], help="Position of the label inside each tile")
    parser.add_argument("--label-color", type=str, default="#bbbbbb", help="Text color for labels (default: #bbbbbb)")
    parser.add_argument("--label-stroke-color", type=str, default="#000000", help="Stroke color for labels (default: #000000)")
    parser.add_argument("--label-scale", type=float, default=0.06, help="Label font size as fraction of tile min dimension (default: 0.06)")
    parser.add_argument("--label-stroke-width", type=int, default=2, help="Stroke width for label text (default: 2)")
    parser.add_argument("--label-padding", type=int, default=18, help="Padding from tile edge in pixels (default: 18)")
    parser.add_argument("--label-dx", type=int, default=0, help="Extra horizontal offset for label (pixels). +right, -left (default: 0)")
    parser.add_argument("--label-dy", type=int, default=0, help="Extra vertical offset for label (pixels). +down, -up (default: 0)")
    return parser.parse_args()


def load_images(image_paths: List[Path]) -> List[Image.Image]:
    images: List[Image.Image] = []
    for path in image_paths:
        img = Image.open(path)
        # Convert to RGB to avoid issues with PNG alpha when composing on solid background
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        images.append(img)
    return images


def compute_tile_size(images: List[Image.Image]) -> Tuple[int, int]:
    # Choose a tile size that does not upscale any image: use min width/height
    min_w = min(img.width for img in images)
    min_h = min(img.height for img in images)
    return min_w, min_h


def make_tiles(images: List[Image.Image], tile_size: Tuple[int, int], background_rgb: Tuple[int, int, int]) -> List[Image.Image]:
    tile_w, tile_h = tile_size
    tiles: List[Image.Image] = []
    for img in images:
        # COVER-FIT: scale image so it completely covers the tile, then center-crop
        scale = max(tile_w / img.width, tile_h / img.height)
        scaled_w = int(math.ceil(img.width * scale))
        scaled_h = int(math.ceil(img.height * scale))

        fitted = img.resize((scaled_w, scaled_h), resample=Image.Resampling.LANCZOS)

        # If source has alpha, composite onto solid background after cropping
        left = max((scaled_w - tile_w) // 2, 0)
        top = max((scaled_h - tile_h) // 2, 0)
        right = left + tile_w
        bottom = top + tile_h
        cropped = fitted.crop((left, top, right, bottom))

        if cropped.mode == "RGBA":
            bg = Image.new("RGB", (tile_w, tile_h), background_rgb)
            cropped = Image.alpha_composite(bg.convert("RGBA"), cropped).convert("RGB")

        tiles.append(cropped)
    return tiles


def build_collage(
    tiles: List[Image.Image],
    rows: int,
    cols: int,
    gap: int,
    margins: Tuple[int, int, int, int],
    background_rgb: Tuple[int, int, int],
    labels_cfg: dict | None = None,
) -> Image.Image:
    if not tiles:
        raise ValueError("No tiles to compose.")

    tile_w, tile_h = tiles[0].width, tiles[0].height

    top, right, bottom, left = margins
    collage_w = left + cols * tile_w + (cols - 1) * gap + right
    collage_h = top + rows * tile_h + (rows - 1) * gap + bottom

    canvas = Image.new("RGB", (collage_w, collage_h), background_rgb)

    for idx, tile in enumerate(tiles):
        r = idx // cols
        c = idx % cols
        x = left + c * (tile_w + gap)
        y = top + r * (tile_h + gap)
        if r < rows and c < cols:
            canvas.paste(tile, (x, y))
            if labels_cfg is not None:
                _draw_tile_label(
                    canvas,
                    text=str(idx + 1),
                    x=x,
                    y=y,
                    tile_w=tile_w,
                    tile_h=tile_h,
                    cfg=labels_cfg,
                )

    return canvas


def _load_font(target_px: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    # Try a few common fonts; fallback to default if none found
    candidate_fonts = [
        "DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ]
    for path in candidate_fonts:
        try:
            return ImageFont.truetype(path, size=target_px)
        except Exception:
            continue
    try:
        return ImageFont.truetype("DejaVuSans.ttf", size=target_px)
    except Exception:
        return ImageFont.load_default()


def _draw_tile_label(
    canvas: Image.Image,
    text: str,
    x: int,
    y: int,
    tile_w: int,
    tile_h: int,
    cfg: dict,
) -> None:
    draw = ImageDraw.Draw(canvas)
    font_size = max(12, int(min(tile_w, tile_h) * float(cfg.get("label_scale", 0.08))))
    font = _load_font(font_size)

    # Measure text
    # Use textbbox to get precise glyph bounds and add a small safety inset to avoid clipping
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=int(cfg.get("label_stroke_width", 2)))
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    safety = max(2, int(min(tile_w, tile_h) * 0.01))

    pad = int(cfg.get("label_padding", 12))
    pos = cfg.get("label_position", "top-left")

    if pos == "top-left":
        tx, ty = x + pad, y + pad
    elif pos == "top-right":
        tx, ty = x + tile_w - pad - text_w, y + pad
    elif pos == "bottom-left":
        tx, ty = x + pad, y + tile_h - pad - text_h
    else:  # bottom-right
        tx, ty = x + tile_w - pad - text_w, y + tile_h - pad - text_h

    # Apply custom offsets and safety inset so stroke/bearings don't clip at edges
    dx = int(cfg.get("label_dx", 0))
    dy = int(cfg.get("label_dy", 0))
    tx += dx
    ty += dy
    tx = max(x + safety, min(tx, x + tile_w - safety - text_w))
    ty = max(y + safety, min(ty, y + tile_h - safety - text_h))

    fill_rgb = ImageColor.getrgb(cfg.get("label_color", "#bbbbbb"))
    stroke_rgb = ImageColor.getrgb(cfg.get("label_stroke_color", "#000000"))
    draw.text(
        (tx, ty),
        text,
        font=font,
        fill=fill_rgb,
        stroke_width=int(cfg.get("label_stroke_width", 2)),
        stroke_fill=stroke_rgb,
    )


def main() -> int:
    args = parse_args()

    script_dir = Path(__file__).resolve().parent
    input_dir = Path(args.input_dir) if args.input_dir else script_dir
    background_rgb = ImageColor.getrgb(args.background)

    pattern = str(input_dir / args.pattern)
    matched_paths = [Path(p) for p in glob.glob(pattern)]

    def screenshot_order_key(p: Path) -> int:
        # Extract trailing integer after 'screenshot_' or 'screenshot-' in filename stem
        m = re.search(r"(?i)screenshot[_-]?(\d+)$", p.stem)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                pass
        # Fallback: try any number in the stem
        m2 = re.search(r"(\d+)", p.stem)
        if m2:
            try:
                return int(m2.group(1))
            except ValueError:
                pass
        # Place unknowns at the end but keep deterministic order
        return 10**9

    matched_paths.sort(key=screenshot_order_key)

    if not matched_paths:
        print(f"No images found matching {pattern}", file=sys.stderr)
        return 1

    max_needed = min(args.max_images, args.rows * args.cols)
    selected_paths = matched_paths[:max_needed]

    images = load_images(selected_paths)
    tile_size = compute_tile_size(images)
    tiles = make_tiles(images, tile_size, background_rgb)

    labels_cfg = None
    if bool(getattr(args, "labels", True)):
        labels_cfg = {
            "label_position": args.label_position,
            "label_color": args.label_color,
            "label_stroke_color": args.label_stroke_color,
            "label_scale": args.label_scale,
            "label_stroke_width": args.label_stroke_width,
            "label_padding": args.label_padding,
            "label_dx": args.label_dx,
            "label_dy": args.label_dy,
        }

    # Resolve asymmetric margins
    top = args.margin_top if args.margin_top is not None else args.margin
    right = args.margin_right if args.margin_right is not None else args.margin
    bottom = args.margin_bottom if args.margin_bottom is not None else args.margin
    left = args.margin_left if args.margin_left is not None else args.margin

    collage = build_collage(
        tiles,
        args.rows,
        args.cols,
        args.gap,
        (top, right, bottom, left),
        background_rgb,
        labels_cfg=labels_cfg,
    )

    output_path = (input_dir / args.output).resolve()
    collage.save(output_path)
    print(f"Saved collage: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


