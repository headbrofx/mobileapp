"""Render "Afya Nyumbani" as raised 3-D lettering, and the icons from it.

    python scripts/make-brand-art.py

Needs Pillow and the Jakarta ExtraBold file that ships in node_modules,
so run it after npm install. It writes assets/wordmark-3d*.png, the app
icon, the Android adaptive icons and the web icons under public/.


The business's own logo has the name in raised plastic-looking letters,
and that is what the owner wants back — but the artwork that carried it
was cropped flat across the top of the caps, and no amount of layout
puts pixels back that were never exported. So the lettering is built
here instead, from the app's own typeface, which means it can be made
at any size with nothing clipped.

How the depth is made, in order:

  1. a contact shadow — the glyph blurred and pushed down, so the
     letters sit on the surface rather than float above it
  2. an extrusion — the glyph stamped repeatedly along one diagonal in
     a darkened shade, which is the side wall of each letter
  3. the face — a vertical gradient from a lighter tint at the top to
     the base colour at the bottom, so the surface catches light
  4. a rim light — the glyph minus a copy of itself nudged down-right,
     which leaves a thin bright edge along the top-left
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# Run from anywhere: everything is written relative to mobile/.
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

FONT = 'node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'

ORANGE = (253, 96, 0)
BLUE = (13, 64, 143)


def shade(rgb, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in rgb)


def glyph_mask(size, text, font, pos):
    layer = Image.new('L', size, 0)
    ImageDraw.Draw(layer).text(pos, text, font=font, fill=255)
    return layer


def gradient(size, top, bottom):
    ramp = Image.new('RGB', (1, size[1]))
    px = ramp.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return ramp.resize(size, Image.BILINEAR)


def _extent(mask):
    box = mask.getbbox()
    return (box[1], box[3]) if box else (0, 0)


def raised(canvas, text, font, pos, colour, depth):
    """Draw one run of text onto `canvas` (RGBA) as a raised solid."""
    size = canvas.size
    mask = glyph_mask(size, text, font, pos)

    # 1. contact shadow
    shadow = mask.filter(ImageFilter.GaussianBlur(depth * 0.55))
    shadow = ImageChops.offset(shadow, int(depth * 0.5), int(depth * 0.9))
    shadow = shadow.point(lambda v: int(v * 0.42))
    canvas.paste(Image.new('RGBA', size, (40, 20, 8, 255)), (0, 0), shadow)

    # 2. extrusion — the side wall, darkest at the back
    for i in range(depth, 0, -1):
        step = ImageChops.offset(mask, i, i)
        wall = shade(colour, 0.42 + 0.16 * (1 - i / depth))
        canvas.paste(Image.new('RGBA', size, wall + (255,)), (0, 0), step)

    # 3. the face, lighter at the top so the surface catches light
    face = gradient(size, shade(colour, 1.30), shade(colour, 0.88)).convert('RGBA')
    canvas.paste(face, (0, 0), mask)

    # 4. gloss — a soft band across the upper part of every letter, which
    #    is what makes the lettering read as moulded plastic rather than
    #    as a flat shape with a shadow behind it.
    top, bottom = _extent(mask)
    gloss = Image.new('L', size, 0)
    band = int((bottom - top) * 0.46)
    if band > 0:
        ramp = gradient((size[0], band), (255, 255, 255), (0, 0, 0)).convert('L')
        gloss.paste(ramp, (0, top))
        gloss = ImageChops.multiply(gloss, mask)
        gloss = gloss.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: int(v * 0.30))
        canvas.paste(Image.new('RGBA', size, (255, 255, 255, 255)), (0, 0), gloss)

    # 5. rim light along the top-left edge
    rim = ImageChops.subtract(mask, ImageChops.offset(mask, 4, 4))
    rim = rim.filter(ImageFilter.GaussianBlur(1.0)).point(lambda v: int(v * 0.55))
    canvas.paste(Image.new('RGBA', size, shade(colour, 1.7) + (255,)), (0, 0), rim)


def render(font_size, stacked, pad_ratio=0.34):
    """Two lines when stacked (for a square icon), one when not."""
    font = ImageFont.truetype(FONT, font_size)
    probe = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    depth = max(3, round(font_size * 0.075))

    if stacked:
        lines = ['Afya', 'Nyumbani']
        colours = [ORANGE, BLUE]
        widths = [probe.textlength(t, font=font) for t in lines]
        boxes = [probe.textbbox((0, 0), t, font=font) for t in lines]
        line_h = max(b[3] - b[1] for b in boxes)
        gap = int(font_size * 0.12)
        text_w = max(widths)
        text_h = line_h * 2 + gap
    else:
        lines = ['Afya ', 'Nyumbani']
        colours = [ORANGE, BLUE]
        widths = [probe.textlength(t, font=font) for t in lines]
        boxes = [probe.textbbox((0, 0), ''.join(lines), font=font)]
        text_w = sum(widths)
        text_h = boxes[0][3] - boxes[0][1]

    pad = int(font_size * pad_ratio)
    size = (int(text_w) + pad * 2 + depth, int(text_h) + pad * 2 + depth)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))

    if stacked:
        for index, (text, colour) in enumerate(zip(lines, colours)):
            box = probe.textbbox((0, 0), text, font=font)
            x = (size[0] - depth - probe.textlength(text, font=font)) / 2
            y = pad - box[1] + index * (line_h + gap)
            raised(canvas, text, font, (x, y), colour, depth)
    else:
        x = pad
        for text, colour in zip(lines, colours):
            box = probe.textbbox((0, 0), text, font=font)
            raised(canvas, text, font, (x, pad - box[1]), colour, depth)
            x += probe.textlength(text, font=font)

    return canvas


os.makedirs('assets', exist_ok=True)

stacked = render(190, stacked=True)
stacked.save('assets/wordmark-3d-stacked.png')
print('stacked', stacked.size, 'bbox', stacked.getchannel('A').getbbox())

single = render(150, stacked=False)
single.save('assets/wordmark-3d.png')
print('single ', single.size, 'bbox', single.getchannel('A').getbbox())


# --- Everything that is made out of the lettering ---------------------
#
# The house-and-stethoscope mark used to be the app icon. The owner asked
# for the name instead, in the raised lettering, so every icon below is
# cut from the same artwork and nothing is scaled up from a small file.

CREAM = (239, 232, 224)

art = Image.open('assets/wordmark-3d-stacked.png').convert('RGBA')
art = art.crop(art.getchannel('A').getbbox())


def square(size, fill_ratio, bg=CREAM):
    canvas = Image.new('RGBA', (size, size), bg + (255,))
    w = int(size * fill_ratio)
    h = int(art.height * (w / art.width))
    if h > w:
        h, w = w, int(art.width * (w / art.height))
    scaled = art.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - w) // 2, (size - h) // 2))
    return canvas.convert('RGB')


square(1024, 0.82).save('assets/icon.png')
square(512, 0.82).save('public/icon-512.png')
square(192, 0.82).save('public/icon-192.png')
square(196, 0.86).save('public/favicon-196.png')
# Android crops a maskable icon to a circle, so only the middle ~66%
# is guaranteed to survive.
square(512, 0.62).save('public/icon-maskable-512.png')

# Android adaptive icon: foreground inset to the safe circle, flat
# background, and a white silhouette for themed icons.
S = 1024
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
w = int(S * 0.60)
h = int(art.height * (w / art.width))
fg.alpha_composite(art.resize((w, h), Image.LANCZOS), ((S - w) // 2, (S - h) // 2))
fg.save('assets/android-icon-foreground.png')
Image.new('RGB', (S, S), CREAM).save('assets/android-icon-background.png')
mono = Image.new('RGBA', (S, S), (0, 0, 0, 0))
mono.paste(
    Image.new('RGBA', (S, S), (255, 255, 255, 255)),
    (0, 0),
    fg.getchannel('A').point(lambda v: 255 if v > 110 else 0),
)
mono.save('assets/android-icon-monochrome.png')

# The launch screen draws this at 260 CSS pixels, so it ships at 520.
single_art = Image.open('assets/wordmark-3d.png').convert('RGBA')
single_art = single_art.crop(single_art.getchannel('A').getbbox())
w = 520
single_art.resize((w, int(single_art.height * (w / single_art.width))), Image.LANCZOS).save(
    'public/wordmark-3d.png'
)

print('icons rebuilt')
