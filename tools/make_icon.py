"""make_icon.py — draws the NomNom app icon: the calorie ring as a happy cat with soft kitten ears.

Purpose:
    The icon is drawn with code (no image tool), so it can be tweaked and redrawn exactly. Writes
    icons/icon-180.png (iPhone Home Screen), icon-192.png and icon-512.png. Square on purpose: the
    iPhone rounds the corners itself. After changing the icons, bump VERSION in sw.js; a phone only
    picks up a new Home Screen icon when the app is added to the Home Screen again.

Usage:
    python3 tools/make_icon.py          (needs Pillow: pip install pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ICONS = Path(__file__).resolve().parent.parent / "icons"
S = 2048                              # drawn big, then scaled down for smooth edges
GREEN = (52, 199, 89, 255)            # the app's green
WHITE = (242, 242, 247, 255)
C, R, W = (0.5, 0.56), 0.30, 0.075    # ring centre, radius (middle of the stroke), stroke; 0–1 of the icon
EARS = dict(at=40, spread=25, height=0.175, tilt=-4, round_=0.024)  # soft kitten ears (chosen 2026-11-25)


def background():
    """Dark vertical gradient, the same as the app's first icon."""
    img = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):
        v = int(30 - 22 * y / S)
        d.line([(0, y), (S, y)], fill=(v, v, v + 2, 255))
    return img


def px(p):
    return (p[0] * S, p[1] * S)


def dot(d, p, w, color):
    x, y = px(p)
    d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=color)


def stroke(d, pts, w, color):
    """Line through pts with round joins and round ends."""
    d.line([px(p) for p in pts], fill=color, width=int(w), joint="curve")
    for p in pts:
        dot(d, p, w, color)


def polar(angle, radius):
    """Point at angle (degrees from 12 o'clock, clockwise) and radius from the ring centre."""
    a = math.radians(angle)
    return (C[0] + radius * math.sin(a), C[1] - radius * math.cos(a))


def arc_pts(c, r, start, sweep, n=90):
    return [(c[0] + r * math.sin(math.radians(start + sweep * i / n)),
             c[1] - r * math.cos(math.radians(start + sweep * i / n))) for i in range(n + 1)]


def ears(img, at, spread, height, tilt, round_):
    """Two rounded triangle ears standing on the ring."""
    for side in (-1, 1):
        a = side * at
        tip = polar(a + side * tilt, R + height)
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).polygon([px(polar(a - spread, R)), px(tip), px(polar(a + spread, R)), px(C)], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(S * round_)).point(lambda v: 255 if v > 128 else 0)
        img.paste(Image.new("RGBA", (S, S), GREEN), (0, 0), mask)
    inner = Image.new("L", (S, S), 0)  # hide the ear bases inside the ring
    ri = R - W / 2
    ImageDraw.Draw(inner).ellipse([(C[0] - ri) * S, (C[1] - ri) * S, (C[0] + ri) * S, (C[1] + ri) * S], fill=255)
    img.paste(background(), (0, 0), inner)


def face(d):
    """Smiling closed eyes, a little nose and an ω mouth."""
    for x in (0.5 - 0.095, 0.5 + 0.095):
        stroke(d, arc_pts((x, 0.53 + 0.042 * 0.55), 0.042, -62, 124), S * 0.034, WHITE)
    y, r, w = 0.615, 0.03, S * 0.028
    dot(d, (0.5, y - 0.028), w * 1.5, WHITE)
    stroke(d, arc_pts((0.5 - r, y), r, 90, 180), w, WHITE)
    stroke(d, arc_pts((0.5 + r, y), r, 90, 180), w, WHITE)


def draw():
    img = background()
    ears(img, **EARS)
    d = ImageDraw.Draw(img)
    stroke(d, arc_pts(C, R, 220, 280), S * W, GREEN)  # the ring: 280°, gap at the bottom, like in the app
    face(d)
    return img.convert("RGB")


if __name__ == "__main__":
    icon = draw()
    for size in (180, 192, 512):
        icon.resize((size, size), Image.LANCZOS).save(ICONS / f"icon-{size}.png", optimize=True)
    print("icons written to", ICONS)
