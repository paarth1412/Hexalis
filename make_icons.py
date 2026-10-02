#!/usr/bin/env python3
"""
Regenerate every favicon / app icon from the master logo artwork.

    python3 -m pip install --user pillow
    python3 make_icons.py

Source: assets/brand/hexalis-mark-teal.png (the 1254x1254 artwork supplied by
HEXALIS). Output is committed, so the normal build never needs Pillow.
Run this only when the logo itself changes.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "assets/brand/hexalis-mark-teal.png")
OUT = HERE                       # favicon.ico etc. must sit at the web root
IMG = os.path.join(HERE, "assets/img")

src = Image.open(SRC).convert("RGBA")
bbox = src.split()[3].point(lambda a: 255 if a > 8 else 0).getbbox()
mark = src.crop(bbox)            # the mark itself, no dead canvas around it


def square(pad_ratio, bg=None, size=1024):
    """Centre the mark on a square canvas with `pad_ratio` breathing room."""
    w, h = mark.size
    side = int(max(w, h) / (1 - 2 * pad_ratio))
    canvas = Image.new("RGBA", (side, side), bg or (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


# Browser tab + Google results: transparent, the mark fills the square.
# (Google shows these on white in light mode and on grey in dark mode,
# which is why the old dark rounded square looked wrong.)
tab = square(0.04)
for s in (16, 32, 48, 96, 144, 192):
    tab.resize((s, s), Image.LANCZOS).save(os.path.join(IMG, f"favicon-{s}.png"), optimize=True)
tab.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

# iOS home screen ignores transparency (paints it black), so: white ground.
square(0.16, bg=(255, 255, 255, 255)).resize((180, 180), Image.LANCZOS).save(
    os.path.join(OUT, "apple-touch-icon.png"), optimize=True)

# Android / PWA: "any" is transparent, "maskable" keeps the mark inside the
# 80% safe circle Android crops to.
for s in (192, 512):
    square(0.04).resize((s, s), Image.LANCZOS).save(os.path.join(IMG, f"icon-{s}.png"), optimize=True)
    square(0.22, bg=(255, 255, 255, 255)).resize((s, s), Image.LANCZOS).save(
        os.path.join(IMG, f"icon-maskable-{s}.png"), optimize=True)

# Social share card fallback colour sample, printed for reference
px = [p for p in mark.getdata() if p[3] == 255]
r, g, b = (sum(c[i] for c in px) // len(px) for i in range(3))
print(f"mark bbox {bbox}, mark colour #{r:02x}{g:02x}{b:02x}")
