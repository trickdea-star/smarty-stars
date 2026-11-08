"""Cut a kid's drawing out of a phone photo, ready to be a game character.

    python tools/cutout_drawing.py drawings/IMG_1234.jpg assets/zombies/mr-stinky.png
    python tools/cutout_drawing.py photo.jpg out.png --crop 80,230,1390,940 --outline --smooth 7
        (lined paper / pencil shading / fingers in the photo: crop to the drawing and cut along the dark outline;
         add --color if a colored part goes missing, --pockets if paper stays stuck between body parts)
    Always look at the result on a dark background before using it.

What it does:
  1. Evens out the lighting, so the paper turns white and the colors pop.
  2. Removes the paper around the drawing (only paper that touches the edge of the
     photo, so white eyes and teeth inside the outline stay).
  3. Drops stray specks, crops tight, and saves a see-through PNG 860 pixels tall.

Needs Pillow and numpy (pip install pillow numpy).
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

OUT_HEIGHT = 600      # tall enough for the biggest zombie on a sharp phone screen
WORK_SIZE = 1600      # photos are shrunk to this before processing


def paper_light(rgb, blocks=24):
    """Estimate the color of the bare paper at every spot, so uneven lighting can be removed.
    Only paper-looking pixels (bright, not colorful) are sampled; under big colored-in areas
    the paper color is filled in from the paper around them."""
    h, w, _ = rgb.shape
    v = rgb.max(axis=2)
    s = (v - rgb.min(axis=2)) / np.maximum(v, 1)
    cand = (s < 0.22) & (v > np.percentile(v, 60) * 0.45)   # 0.45 so paper in a shadow still counts
    bh, bw = max(1, h // blocks), max(1, w // blocks)
    small = np.zeros((blocks, blocks, 3), np.float32)
    have = np.zeros((blocks, blocks), bool)
    for by in range(blocks):
        for bx in range(blocks):
            sl = (slice(by * bh, (by + 1) * bh), slice(bx * bw, (bx + 1) * bw))
            px = rgb[sl][cand[sl]]
            if len(px) > 0.15 * bh * bw:
                small[by, bx] = np.median(px, axis=0)
                have[by, bx] = True
    if not have.any():
        small[:] = np.percentile(rgb.reshape(-1, 3), 95, axis=0)
        have[:] = True
    while not have.all():   # grow known paper color into the blocks covered by drawing
        nxt_s, nxt_h = small.copy(), have.copy()
        for by in range(blocks):
            for bx in range(blocks):
                if have[by, bx]:
                    continue
                nb = [(by + dy, bx + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and 0 <= by + dy < blocks and 0 <= bx + dx < blocks and have[by + dy, bx + dx]]
                if nb:
                    nxt_s[by, bx] = np.mean([small[p] for p in nb], axis=0)
                    nxt_h[by, bx] = True
        small, have = nxt_s, nxt_h
    img = Image.fromarray(np.clip(small, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    return np.asarray(img.resize((w, h), Image.BICUBIC), np.float32)


def keep_big_blobs(mask, keep_ratio=0.04):
    """Keep the biggest connected shape (and any shape at least keep_ratio of its size)."""
    small = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize(
        (max(1, mask.shape[1] // 4), max(1, mask.shape[0] // 4)), Image.BILINEAR)) > 40
    h, w = small.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    for y in range(h):
        for x in range(w):
            if small[y, x] and not labels[y, x]:
                n = len(sizes)
                sizes.append(0)
                q = deque([(y, x)])
                labels[y, x] = n
                while q:
                    cy, cx = q.popleft()
                    sizes[n] += 1
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = n
                            q.append((ny, nx))
    if len(sizes) == 1:
        return mask
    biggest = max(sizes)
    keep = np.isin(labels, [i for i, s in enumerate(sizes) if i and s >= biggest * keep_ratio])
    keep_full = np.asarray(Image.fromarray(keep.astype(np.uint8) * 255).resize(
        (mask.shape[1], mask.shape[0]), Image.NEAREST).filter(ImageFilter.MaxFilter(9))) > 0
    return mask & keep_full


def drop_paper_pockets(drawing, paper, min_frac=0.004):
    """Remove big patches of bare paper trapped inside the drawing (e.g. between an arm and the head).
    Small white parts like teeth and eye shines are kept."""
    pockets = drawing & paper
    sh = (max(1, drawing.shape[1] // 4), max(1, drawing.shape[0] // 4))
    small = np.asarray(Image.fromarray(pockets.astype(np.uint8) * 255).resize(sh, Image.BILINEAR)) > 100
    h, w = small.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    for y in range(h):
        for x in range(w):
            if small[y, x] and not labels[y, x]:
                n = len(sizes); sizes.append(0)
                q = deque([(y, x)]); labels[y, x] = n
                while q:
                    cy, cx = q.popleft(); sizes[n] += 1
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = n; q.append((ny, nx))
    limit = drawing.mean() * h * w * min_frac
    big = np.isin(labels, [i for i, s in enumerate(sizes) if i and s >= limit])
    big_full = np.asarray(Image.fromarray(big.astype(np.uint8) * 255).resize(
        (drawing.shape[1], drawing.shape[0]), Image.NEAREST).filter(ImageFilter.MaxFilter(5))) > 0
    return drawing & ~(big_full & np.asarray(Image.fromarray(pockets.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0)


def cutout(src, dst, crop=None, outline=None, smooth=0, color=False, pockets=False):
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    if crop:
        im = im.crop(crop)          # cut away fingers, binder holes, the table, etc. first
    im.thumbnail((WORK_SIZE, WORK_SIZE))
    rgb = np.asarray(im, np.float32)

    # 1. even out the lighting: divide by the paper brightness so paper becomes white
    light = np.maximum(paper_light(rgb), 40)
    norm = np.clip(rgb / light * 255 * 1.04, 0, 255)

    v = norm.max(axis=2)
    s = (v - norm.min(axis=2)) / np.maximum(v, 1)
    if outline:
        # outline mode (lined paper, pencil shading): only the dark marker outline stops the paper flood,
        # so ruled lines and light shading outside the drawing are thrown away
        barrier = v < outline
    else:
        # 2. paper-like = bright and not colorful
        barrier = ~((v > 190) & (s < 0.18))
    # close tiny gaps in the outline so the paper flood can't leak inside the drawing
    ink = Image.fromarray(barrier.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))
    fill = Image.fromarray(np.where(np.asarray(ink) > 0, 0, 255).astype(np.uint8)).copy()   # .copy(): writable
    w, h = fill.size
    border = [(x, 0) for x in range(0, w, 3)] + [(x, h - 1) for x in range(0, w, 3)] + \
             [(0, y) for y in range(0, h, 3)] + [(w - 1, y) for y in range(0, h, 3)]
    for p in border:
        if fill.getpixel(p) == 255:
            ImageDraw.floodfill(fill, p, 128)
    outside = np.asarray(fill) == 128
    # grow the outside back over the gap-closing margin (plus 1px) so no white paper rim is left
    outside = np.asarray(Image.fromarray(outside.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5 if outline else 7))) > 0
    drawing = ~outside
    if color:   # anything clearly colored in is part of the drawing, even where its outline has a gap
        drawing |= (s > 0.3) & (v > 50)
    if pockets:
        drawing = drop_paper_pockets(drawing, (v > 190) & (s < 0.18))
    if smooth:   # shave off thin pencil scribbles stuck to the outline (keeps anything thicker than `smooth` px)
        m = Image.fromarray(drawing.astype(np.uint8) * 255)
        drawing = np.asarray(m.filter(ImageFilter.MinFilter(smooth)).filter(ImageFilter.MaxFilter(smooth))) > 0
    drawing = keep_big_blobs(drawing)

    # 3. crop, soften the edge, resize
    ys, xs = np.nonzero(drawing)
    if not len(ys):
        sys.exit('Could not find a drawing in ' + src)
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    alpha = Image.fromarray(drawing.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.0))
    out = Image.fromarray(norm.astype(np.uint8)).convert('RGBA')
    out.putalpha(alpha)
    out = out.crop((x0, y0, x1, y1))
    scale = OUT_HEIGHT / out.height
    out = out.resize((max(1, round(out.width * scale)), OUT_HEIGHT), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    out.save(dst, optimize=True)
    print('saved %s (%dx%d, kept %.0f%% of the photo)' % (dst, out.width, out.height, 100 * drawing.mean()))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Cut a drawing out of a photo.')
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--crop', help='x0,y0,x1,y1 in photo pixels: keep only this box (drop fingers, holes, table)')
    ap.add_argument('--outline', type=int, nargs='?', const=90, help='lined paper or shading: only dark outline '
                    '(darker than this, 0-255, default 90) counts as the edge of the drawing')
    ap.add_argument('--smooth', type=int, default=0, help='remove thin scribbles thinner than this many pixels (try 7)')
    ap.add_argument('--color', action='store_true', help='keep every clearly colored-in area (fixes gaps in the outline)')
    ap.add_argument('--pockets', action='store_true', help='also remove big patches of paper trapped inside the drawing '
                    '(skip this for drawings colored in very light colors)')
    a = ap.parse_args()
    cutout(a.src, a.dst, tuple(int(n) for n in a.crop.split(',')) if a.crop else None, a.outline, a.smooth, a.color, a.pockets)
