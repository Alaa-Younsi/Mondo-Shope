"""
Turns the supplied logo.png into the tightly-cropped public/logo.png the site
header, favicon and OG card use.

The source artwork is already transparent, but the canvas carries a 3px
near-black + olive frame down the left and right edges and a lot of empty
vertical margin. On the dark storefront that frame reads as a faint plate
behind the wordmark, and the margin shrinks the visible logo inside its box.

Approach: inset by a few pixels to drop the frame outright, then crop to the
remaining alpha bounding box. Deterministic, and it cannot eat artwork the way
a colour threshold can (the "SHOPE" wordmark is itself very pale).

Run:  python scripts/prepare-logo.py
Source of truth is logo.png in the project root; this only writes public/.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "logo.png"
DST = ROOT / "public" / "logo.png"

INSET = 4


def main() -> None:
    image = Image.open(SRC).convert("RGBA")
    width, height = image.size

    image = image.crop((INSET, INSET, width - INSET, height - INSET))

    box = image.getbbox()
    if box:
        image = image.crop(box)

    DST.parent.mkdir(parents=True, exist_ok=True)
    image.save(DST, optimize=True)
    print(f"wrote {DST} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
