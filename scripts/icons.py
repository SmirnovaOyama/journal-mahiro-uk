"""Makes the site's icons from design/logo.jpg.

    python3 scripts/icons.py

The favicons and the manifest's "any" icons are round, with two cat ears
standing up on the circle's top edge and nothing but see-through around
them. favicon.png and favicon-32.png are cut closer, on the face, so it
still reads at 16 to 32 pixels; the large ones show more of the picture.
The apple-touch icon and the maskable one are full squares, since iOS and
Android cut them to their own shape. The in-app logos (pwa-192x192.png,
logo.png) stay rounded rectangles, as the pages frame them that way."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / 'design/logo.jpg').convert('RGB')
OUT = ROOT / 'public'
W, H = SRC.size
RADIUS = 0.2237  # an app icon's corner, as a share of its side

# The cat-ear icon, as shares of its side
CIRCLE_CY = 0.575   # the circle's centre, low enough to leave room for the ears
CIRCLE_R = 0.415
EAR_AT = 44          # degrees from straight up to the middle of each ear
EAR_HALF = 25        # half the ear's width at its base, in degrees round the circle
EAR_TIP = 1.5       # the tip's distance from the centre, in radii
EAR_SKEW = -5        # tips lean outward by this many degrees
FUR = (226, 214, 211)    # the hair's grey-beige
INNER = (246, 186, 188)  # the pink inside her ears
INK = (66, 48, 46)       # the drawing's line colour


def crop(share, cx=0.5, cy=0.5):
    """A square of `share` of the picture's side, centred on (cx, cy)."""
    side = round(min(W, H) * share)
    x = min(max(round(W * cx - side / 2), 0), W - side)
    y = min(max(round(H * cy - side / 2), 0), H - side)
    return SRC.crop((x, y, x + side, y + side))


def rounded(img, size):
    """The square at `size`, with its corners cut round and see-through."""
    big = size * 4
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * RADIUS), fill=255)
    out = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def ear(cx, cy, r, side, scale=1.0):
    """One ear's three corners: two on the circle, the tip outside it.
    `side` is -1 for the left ear, 1 for the right."""
    def at(deg, dist):
        a = math.radians(deg * side)
        return (cx + math.sin(a) * dist, cy - math.cos(a) * dist)
    half = EAR_HALF * scale
    tip_dist = r + (EAR_TIP - 1) * r * scale
    base_dist = r * (1 - 0.18 * scale)  # tuck the base inside, under the circle
    return [at(EAR_AT - half, base_dist), at(EAR_AT + EAR_SKEW * -1, tip_dist), at(EAR_AT + half, base_dist)]


def eared(img, size):
    """The picture in a circle with two cat ears, on a see-through square."""
    s = size * 8  # drawn large, then shrunk, for smooth edges
    cx, cy, r = s / 2, s * CIRCLE_CY, s * CIRCLE_R
    line = max(s * 0.022, 8 * 1.6) if size <= 32 else s * 0.014
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    def soft(pts, k=0.0):
        """A filled ear shape, `k` of the way in towards its middle, its corners rounded."""
        mx = sum(p[0] for p in pts) / 3
        my = sum(p[1] for p in pts) / 3
        m = Image.new('L', (s, s), 0)
        ImageDraw.Draw(m).polygon([(mx + (x - mx) * (1 - k), my + (y - my) * (1 - k)) for x, y in pts], fill=255)
        return m.filter(ImageFilter.GaussianBlur(s * 0.018)).point(lambda v: 255 if v > 110 else 0)
    scale = 1.25 if size <= 32 else 1.0  # a little bigger where pixels are few
    for side in (-1, 1):
        pts = ear(cx, cy, r, side, scale)
        span = math.dist(pts[0], pts[2])
        canvas.paste(INK, (0, 0), soft(pts))
        canvas.paste(FUR, (0, 0), soft(pts, 2.4 * line / span))
        canvas.paste(INNER, (0, 0), soft(pts, 0.34))
    # the outline ring, then the picture inside it
    ImageDraw.Draw(canvas).ellipse((cx - r - line, cy - r - line, cx + r + line, cy + r + line), fill=INK)
    pic = img.resize((round(2 * r), round(2 * r)), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', pic.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, pic.size[0] - 1, pic.size[1] - 1), fill=255)
    canvas.paste(pic, (round(cx - r), round(cy - r)), mask)
    return canvas.resize((size, size), Image.LANCZOS)


face = crop(0.62, 0.5, 0.5)    # eyes and cheeks, so it reads at 16 pixels
bust = crop(0.72, 0.5, 0.5)    # the face and fringe, her own ears left to the drawn ones
whole = crop(1.0)


def small(img):
    """256 colours: a drawing in flat pastels loses nothing, the file a fifth the size."""
    if img.mode == 'RGBA':
        return img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


eared(face, 64).save(OUT / 'favicon.png', optimize=True)
eared(face, 32).save(OUT / 'favicon-32.png', optimize=True)
small(eared(bust, 192)).save(OUT / 'icon-192.png', optimize=True)
small(eared(bust, 512)).save(OUT / 'app-icon-512.png', optimize=True)
small(rounded(whole, 192)).save(OUT / 'pwa-192x192.png', optimize=True)
small(rounded(whole, 256)).save(OUT / 'logo.png', optimize=True)
small(whole.resize((180, 180), Image.LANCZOS)).save(OUT / 'apple-touch-icon.png', optimize=True)
small(whole.resize((512, 512), Image.LANCZOS)).save(OUT / 'app-icon-512-maskable.png', optimize=True)
print('icons written')
