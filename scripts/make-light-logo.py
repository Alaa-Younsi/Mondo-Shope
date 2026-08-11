"""
Builds public/logo-light.png from public/logo.png.

Why this file exists
--------------------
The logo is two LIGHT marks: "MONDO" in #FFAB40 and "SHOPE" in #EBEFF2. Both
were drawn to sit on the near-black dark theme. On any genuinely light ground
the pale "SHOPE" half disappears, which is exactly what happens on the light
theme, and no single background fixes it: every background dark enough to show
#EBEFF2 at 3:1 drops dark body text below 4.5:1. The two requirements have no
overlap, so the light theme gets its own logo instead of a compromised palette.

Both halves are re-inked for parchment:
  #FFAB40 (pale amber)  -> #B85C09  3.6:1 on --c-bg
  #EBEFF2 (near white)  -> #33240B  11.8:1 on --c-bg

Hue is preserved per half — this is a recolor, not a silhouette. Alpha is
carried through untouched so the antialiased edges stay smooth.

Run after any change to public/logo.png:
    python scripts/make-light-logo.py
"""

from pathlib import Path

from PIL import Image

SRC = Path("public/logo.png")
DST = Path("public/logo-light.png")

# (source colour, replacement) — matched by nearest of the two, so antialiased
# pixels between the marks and transparency still land on the right side.
AMBER_FROM, AMBER_TO = (255, 171, 64), (184, 92, 9)
PALE_FROM, PALE_TO = (235, 239, 242), (51, 36, 11)


def distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b))


def main():
    src = Image.open(SRC).convert("RGBA")
    width, height = src.size
    pixels = list(src.getdata())
    out = []

    for r, g, b, a in pixels:
        if a == 0:
            # Fully transparent pixels keep their (arbitrary) colour, otherwise
            # a browser scaling the image can bleed it into the visible edge.
            out.append((PALE_TO[0], PALE_TO[1], PALE_TO[2], 0))
            continue
        pixel = (r, g, b)
        if distance(pixel, AMBER_FROM) <= distance(pixel, PALE_FROM):
            target = AMBER_TO
        else:
            target = PALE_TO
        out.append((target[0], target[1], target[2], a))

    dst = Image.new("RGBA", (width, height))
    dst.putdata(out)
    dst.save(DST, optimize=True)
    print(f"{DST} written ({width}x{height}, {len(out)} px)")


if __name__ == "__main__":
    main()
