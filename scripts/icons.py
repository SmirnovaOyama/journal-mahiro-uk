"""Makes the site's icons from design/logo.jpg.

    python3 scripts/icons.py

The favicons and the manifest's "any" icons are round: the picture cut to
a circle whose edge runs through her cat ears, the ears standing out past
it, and nothing but see-through around them.
The apple-touch icon and the maskable one are full squares, since iOS and
Android cut them to their own shape. The in-app logos (pwa-192x192.png,
logo.png) stay rounded rectangles, as the pages frame them that way."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / 'design/logo.jpg').convert('RGB')
OUT = ROOT / 'public'
W, H = SRC.size
RADIUS = 0.2237  # an app icon's corner, as a share of its side

# The cat-ear icon: the picture in a circle whose edge runs through her own
# ears, so the ears stand out past it. In the picture's pixels:
CIRCLE = (704, 700, 510)  # centre x, centre y, radius
EAR_ZONES = [(0, 0, 515, 480), (985, 0, W, 480)]  # where the ears are; the tuft between stays cut
INK = (66, 48, 46)  # the drawing's line colour, for the rim


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


def silhouette():
    """Her outline: everything the pink background does not reach. The lines
    are thickened first so the fill cannot leak through a gap in them."""
    walls = SRC.convert('L').point(lambda v: 0 if v < 120 else 255).filter(ImageFilter.MinFilter(3))
    for corner in [(5, 5), (W - 8, 5), (5, H // 2), (W - 8, H // 2)]:
        ImageDraw.floodfill(walls, corner, 128)
    return walls.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MaxFilter(3))


def eared_master():
    """The circle with her ears poking out of it, on a see-through square."""
    cx, cy, r = CIRCLE
    zones = Image.new('L', SRC.size, 0)
    for box in EAR_ZONES:
        ImageDraw.Draw(zones).rectangle(box, fill=255)
    mask = Image.new('L', SRC.size, 0)
    ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    mask = ImageChops.lighter(mask, ImageChops.multiply(silhouette(), zones))
    x0, y0, x1, y1 = mask.getbbox()
    rim = round(r * 0.03)
    side = max(x1 - x0, y1 - y0) + 2 * rim + 4
    left, top = (x0 + x1 - side) // 2, (y0 + y1 - side) // 2
    out = Image.new('RGBA', SRC.size, (0, 0, 0, 0))
    # a thin dark rim round the circle, so it holds its shape on a white tab
    ImageDraw.Draw(out).ellipse((cx - r - rim, cy - r - rim, cx + r + rim, cy + r + rim), fill=INK)
    pic = SRC.convert('RGBA')
    pic.putalpha(mask)
    out.alpha_composite(pic)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(out.crop((max(left, 0), max(top, 0), left + side, top + side)),
                           (max(-left, 0), max(-top, 0)))
    return canvas


whole = crop(1.0)
ears = eared_master()


def small(img):
    """256 colours: a drawing in flat pastels loses nothing, the file a fifth the size."""
    if img.mode == 'RGBA':
        return img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


ears.resize((64, 64), Image.LANCZOS).save(OUT / 'favicon.png', optimize=True)
ears.resize((32, 32), Image.LANCZOS).save(OUT / 'favicon-32.png', optimize=True)
small(ears.resize((192, 192), Image.LANCZOS)).save(OUT / 'icon-192.png', optimize=True)
small(ears.resize((512, 512), Image.LANCZOS)).save(OUT / 'app-icon-512.png', optimize=True)
small(rounded(whole, 192)).save(OUT / 'pwa-192x192.png', optimize=True)
small(rounded(whole, 256)).save(OUT / 'logo.png', optimize=True)
small(whole.resize((180, 180), Image.LANCZOS)).save(OUT / 'apple-touch-icon.png', optimize=True)
small(whole.resize((512, 512), Image.LANCZOS)).save(OUT / 'app-icon-512-maskable.png', optimize=True)
print('icons written')
