"""Makes the site's icons from design/logo.jpg.

    python3 scripts/icons.py

The favicons and the manifest's "any" icons are the whole picture cut to
the circle inside it, as on mahiro.uk: her cat ears sit right on the
circle's edge, and the corners are see-through.
The apple-touch icon and the maskable one are full squares, since iOS and
Android cut them to their own shape. The in-app logos (pwa-192x192.png,
logo.png) stay rounded rectangles, as the pages frame them that way."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / 'design/logo.jpg').convert('RGB')
OUT = ROOT / 'public'
W, H = SRC.size
RADIUS = 0.2237  # an app icon's corner, as a share of its side

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


def circle(img, size):
    """The square at `size`, cut to the circle inside it, see-through outside."""
    big = size * 4
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    out = img.resize((size, size), Image.LANCZOS).convert('RGBA')
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


whole = crop(1.0)


def small(img):
    """256 colours: a drawing in flat pastels loses nothing, the file a fifth the size."""
    if img.mode == 'RGBA':
        return img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    return img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


circle(whole, 64).save(OUT / 'favicon.png', optimize=True)
circle(whole, 32).save(OUT / 'favicon-32.png', optimize=True)
small(circle(whole, 192)).save(OUT / 'icon-192.png', optimize=True)
small(circle(whole, 512)).save(OUT / 'app-icon-512.png', optimize=True)
small(rounded(whole, 192)).save(OUT / 'pwa-192x192.png', optimize=True)
small(rounded(whole, 256)).save(OUT / 'logo.png', optimize=True)
small(whole.resize((180, 180), Image.LANCZOS)).save(OUT / 'apple-touch-icon.png', optimize=True)
small(whole.resize((512, 512), Image.LANCZOS)).save(OUT / 'app-icon-512-maskable.png', optimize=True)
print('icons written')
