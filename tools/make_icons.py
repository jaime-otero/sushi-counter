"""Genera los iconos de la app (hinomaru + nigiri sobre índigo con olas seigaiha).

Uso: python3 tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

S = 1024
AI = (31, 58, 95)
WAVE = (255, 255, 255, 30)
BENI = (196, 31, 62)
RICE = (250, 247, 240)
RICE_SHADE = (226, 220, 206)
SALMON = (240, 128, 92)
SALMON_LINE = (255, 214, 196)
NORI = (24, 32, 30)

OUT = Path(__file__).resolve().parent.parent / "icons"


def seigaiha(img, top, r=64, alpha_line=WAVE):
    """Olas en la parte inferior: filas de semicírculos concéntricos."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rows = []
    y = top
    row = 0
    while y < S + r:
        rows.append((y, (row % 2) * r))
        y += r // 2
        row += 1
    for y, off in rows:
        x = -r + off
        while x < S + 2 * r:
            d.ellipse([x - r, y - r, x + r, y + r], fill=AI + (255,))
            for k in (r - 2, int(r * .75), int(r * .5), int(r * .25)):
                d.ellipse([x - k, y - k, x + k, y + k], outline=alpha_line, width=5)
            x += 2 * r
    img.alpha_composite(layer)


def nigiri(img, cx, cy, w):
    h = w * 0.42
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([cx - w * .5, cy + h * .25, cx + w * .5, cy + h * .75], fill=(0, 0, 0, 90))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))

    d = ImageDraw.Draw(img)
    # arroz
    d.rounded_rectangle([cx - w * .46, cy - h * .25, cx + w * .46, cy + h * .55], radius=h * .4, fill=RICE_SHADE)
    d.rounded_rectangle([cx - w * .46, cy - h * .32, cx + w * .46, cy + h * .45], radius=h * .4, fill=RICE)
    # salmón
    top = Image.new("RGBA", img.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(top)
    td.rounded_rectangle([cx - w * .5, cy - h * .62, cx + w * .5, cy + h * .08], radius=h * .36, fill=SALMON)
    stripes = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    for i in range(-3, 5):
        x0 = cx + i * w * .16
        sd.line([x0 - w * .12, cy + h * .1, x0 + w * .05, cy - h * .7], fill=SALMON_LINE + (200,), width=int(w * .028))
    mask = top.split()[3]
    top.alpha_composite(Image.composite(stripes, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask))
    img.alpha_composite(top)
    # alga
    d = ImageDraw.Draw(img)
    d.rectangle([cx - w * .056, cy - h * .64, cx + w * .056, cy + h * .52], fill=NORI)


def make(size, maskable=False):
    img = Image.new("RGBA", (S, S), AI + (255,))
    seigaiha(img, top=int(S * .70))
    sun_r = S * (.25 if maskable else .29)
    cx, cy = S / 2, S * .44
    d = ImageDraw.Draw(img)
    d.ellipse([cx - sun_r, cy - sun_r, cx + sun_r, cy + sun_r], fill=BENI)
    nigiri(img, cx, S * (.62 if maskable else .64), S * (.48 if maskable else .55))
    return img.convert("RGB").resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    make(180).save(OUT / "apple-touch-icon.png", optimize=True)
    make(192).save(OUT / "icon-192.png", optimize=True)
    make(512).save(OUT / "icon-512.png", optimize=True)
    make(512, maskable=True).save(OUT / "icon-maskable-512.png", optimize=True)
    print("ok", sorted(p.name for p in OUT.iterdir()))
