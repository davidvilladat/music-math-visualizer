"""Draw the SPECTRA app icons: five glowing equalizer bars on a deep night gradient.

Bold and simple so it still reads at home-screen size (60pt). iOS rounds the
corners itself, so the artwork is a full square. Run: python scripts/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
S = 1024
STOPS = [(34, 211, 238), (139, 92, 246), (244, 63, 94)]  # cyan -> violet -> rose


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient_x(t: float):
    return lerp(STOPS[0], STOPS[1], t * 2) if t < 0.5 else lerp(STOPS[1], STOPS[2], (t - 0.5) * 2)


def background() -> Image.Image:
    img = Image.new("RGB", (S, S))
    px = img.load()
    for y in range(S):
        for x in range(S):
            dx, dy = (x - S * 0.5) / S, (y - S * 0.42) / S
            d = min(1.0, (dx * dx + dy * dy) ** 0.5 * 1.6)
            px[x, y] = lerp((28, 20, 58), (3, 3, 8), d)
    return img


def bars(scale: float) -> Image.Image:
    """scale < 1 shrinks the glyph into the maskable safe zone."""
    layer = Image.new("RGB", (S, S), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    heights = [0.30, 0.56, 0.80, 0.56, 0.30]
    w = S * 0.105 * scale
    gap = S * 0.05 * scale
    total = len(heights) * w + (len(heights) - 1) * gap
    x0 = (S - total) / 2
    for i, h in enumerate(heights):
        hh = S * 0.62 * h * scale
        x = x0 + i * (w + gap)
        col = gradient_x(i / (len(heights) - 1))
        d.rounded_rectangle([x, S / 2 - hh / 2, x + w, S / 2 + hh / 2], radius=w / 2, fill=col)
    return layer


def compose(scale: float) -> Image.Image:
    base = background()
    glyph = bars(scale)
    glow = glyph.filter(ImageFilter.GaussianBlur(S * 0.045))
    out = ImageChops.add(base, ImageChops.multiply(glow, Image.new("RGB", (S, S), (190, 190, 190))))
    mask = glyph.convert("L").point(lambda v: 255 if v > 4 else 0)
    out.paste(glyph, (0, 0), mask)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    full, maskable = compose(1.18), compose(0.86)
    for size, name, src in [
        (180, "apple-touch-icon.png", full),
        (192, "icon-192.png", full),
        (512, "icon-512.png", full),
        (512, "icon-maskable-512.png", maskable),
        (32, "favicon-32.png", full),
    ]:
        src.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print("wrote", name)


if __name__ == "__main__":
    main()
