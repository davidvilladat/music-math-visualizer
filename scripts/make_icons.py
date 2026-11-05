"""Draw the SPECTRA app icons (radial spectrum ring on black). Run: python scripts/make_icons.py"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
S = 1024  # master size, downscaled for each icon


def master(safe: float) -> Image.Image:
    """safe = fraction of the canvas the artwork may use (maskable icons need ~0.8)."""
    img = Image.new("RGB", (S, S), (3, 3, 3))
    glow = Image.new("RGB", (S, S), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    c = S / 2
    r0 = S * 0.20 * safe / 0.8
    bars = 64
    for i in range(bars):
        a = i / bars * math.tau - math.pi / 2
        # deterministic "spectrum": two harmonics, so the ring looks musical
        h = 0.35 + 0.65 * abs(math.sin(i * 0.37) * 0.6 + math.sin(i * 0.11 + 1.3) * 0.4)
        length = S * 0.17 * safe / 0.8 * h
        t = i / bars
        col = (int(40 + 200 * (1 - t)), int(150 + 90 * math.sin(t * math.pi)), 255)
        x0, y0 = c + math.cos(a) * r0, c + math.sin(a) * r0
        x1, y1 = c + math.cos(a) * (r0 + length), c + math.sin(a) * (r0 + length)
        g.line([(x0, y0), (x1, y1)], fill=col, width=int(S * 0.016))
    g.ellipse([c - r0 * 0.55, c - r0 * 0.55, c + r0 * 0.55, c + r0 * 0.55], outline=(240, 240, 240), width=int(S * 0.012))
    img.paste(Image.blend(img, glow.filter(ImageFilter.GaussianBlur(S * 0.03)), 0.9))
    sharp = Image.composite(glow, img, glow.convert("L").point(lambda v: 255 if v > 8 else 0))
    return sharp


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    full, maskable = master(0.95), master(0.75)
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
