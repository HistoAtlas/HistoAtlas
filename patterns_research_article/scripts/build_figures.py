#!/usr/bin/env python
"""Draw every figure of the Patterns submission as print-size vector SVG.

Run after export_figure_data.py, from the repository root:

    uv run python patterns_research_article/scripts/build_figures.py

Outputs
  figures/svg/<Figure>.svg          standalone SVG (images linked from figures/assets)
  design/project/<Figure>.dc.html   the same drawing as a Claude Design artboard
Each figure is 174 mm wide (Cell Press full width), Arial 6-8 pt, RGB.
`export_figures.py` turns the SVGs into submission PDF/TIFF files.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from svgkit import (  # noqa: E402
    AXIS, BLUE, CANCER_COLORS, CATEGORY_COLORS, CPTAC_COLORS, FULL_W, GRID, INK, INK2, MM, MUTED,
    ORANGE, PURPLE, SKY, SVG, VERMILLION, GREEN, Lin, Log, axis_bottom, axis_left, colorbar_h,
    colorbar_v, diamond, diverging, fmt_num, legend_item, nice_ticks, sci, sequential, text_width,
    triangle,
)

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "patterns_research_article"
DATA = ART / "figure_data"
ASSETS = ART / "figures/assets"
SVG_OUT = ART / "figures/svg"
for p in (ASSETS, SVG_OUT):
    p.mkdir(parents=True, exist_ok=True)

W = FULL_W
SLIDE_LUAD = "TCGA-MP-A4T9-01Z-00-DX1.F7B341C4-EBCD-455F-BE90-3B77AC6B76EC.svs"
SLIDE_BRCA = "TCGA-A1-A0SE-01Z-00-DX1.04B09232-C6C4-46EF-AA2C-41D078D0A80A.svs"


def load(name):
    return json.load(open(DATA / f"{name}.json"))


# ---------------------------------------------------------------------------
# Raster assets (micrographs are copied unaltered; label maps are recoloured)
# ---------------------------------------------------------------------------
MASK_COLORS = {  # pipeline label colour -> figure colour
    (230, 0, 0): "#b2182b",      # tumor front, 0-50 um inside tumor boundary
    (200, 80, 80): "#ef8a62",    # tumor core, >50 um
    (30, 80, 180): "#2166ac",    # near stroma, 0-50 um outside
    (100, 140, 210): "#67a9cf",  # far stroma, 50-200 um
    (180, 200, 230): "#d1e5f0",  # stroma beyond 200 um
    (180, 180, 180): "#bdbdbd",  # other compartments
}
MASK_LEGEND = [("#b2182b", "Tumor front (0–50 µm)"), ("#ef8a62", "Tumor core (>50 µm)"),
               ("#2166ac", "Near stroma (0–50 µm)"), ("#67a9cf", "Far stroma (50–200 µm)"),
               ("#d1e5f0", "Stroma >200 µm"), ("#bdbdbd", "Other compartments")]


def tile_dir(slide):
    for base in ("web/public/bundles/v1/tiles", "visual_assets/bundles/v1/tiles"):
        p = ROOT / base / slide
        if p.exists():
            return p
    raise FileNotFoundError(slide)


def prepare_assets() -> dict[str, str]:
    """Write figure assets; return {key: relative path}."""
    import shutil
    from PIL import Image

    out = {}

    def recolor(src, dst):
        a = np.array(Image.open(src).convert("RGB"))
        o = np.full_like(a, 255)
        for k, hexc in MASK_COLORS.items():
            m = np.all(a == np.array(k), axis=-1)
            o[m] = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
        Image.fromarray(o).save(dst, optimize=True)

    d = tile_dir(SLIDE_LUAD)
    shutil.copy(d / "thumbnail.jpg", ASSETS / "luad_thumbnail.jpg")
    recolor(d / "mask.png", ASSETS / "luad_compartments.png")
    shutil.copy(d / "16__170__45__224__224.jpg", ASSETS / "luad_tile_he.jpg")
    shutil.copy(d / "16__170__45__224__224_overlay.jpg", ASSETS / "luad_tile_overlay.jpg")
    out.update(luad_thumb="luad_thumbnail.jpg", luad_mask="luad_compartments.png",
               luad_he="luad_tile_he.jpg", luad_ov="luad_tile_overlay.jpg")

    im = Image.open(ROOT / "screenshots/atlas_page.png").convert("RGB")
    im.crop((0, 0, 1440, 890)).resize((1080, 668), Image.LANCZOS).save(ASSETS / "atlas_screenshot.png", optimize=True)
    out["atlas"] = "atlas_screenshot.png"

    d = tile_dir(SLIDE_BRCA)
    recolor(d / "mask.png", ASSETS / "brca_compartments.png")
    out["brca_mask"] = "brca_compartments.png"
    f6 = load("fig6")
    for grp in ("tiles_intratumoral", "tiles_stromal"):
        for t in f6[grp]:
            for sfx in ("", "_overlay"):
                name = f"{t['tileLevel']}__{t['tileX']}__{t['tileY']}__224__224{sfx}.jpg"
                key = f"brca_{t['tileX']}_{t['tileY']}{sfx}"
                shutil.copy(d / name, ASSETS / f"{key}.jpg")
                out[key] = f"{key}.jpg"
    return out


# ---------------------------------------------------------------------------
# Shared drawing helpers
# ---------------------------------------------------------------------------
def heatmap(s: SVG, x, y, cw, ch, M, cmap, vmax, stroke=None):
    for i, row in enumerate(M):
        for j, v in enumerate(row):
            if v is None:
                s.rect(x + j * cw, y + i * ch, cw, ch, fill="#ffffff")
                continue
            s.rect(x + j * cw, y + i * ch, cw + 0.15, ch + 0.15, fill=cmap(v, vmax))
    s.rect(x, y, cw * len(M[0]), ch * len(M), stroke=stroke or AXIS, sw=0.4)


def dendro_top(s: SVG, x0, y0, width, height, dd, n):
    ic, dc = dd["icoord"], dd["dcoord"]
    maxd = max(max(d) for d in dc)
    for xs, ys in zip(ic, dc):
        pts = [(x0 + (xx - 5) / (10 * n) * width + width / (2 * n) - width / (2 * n) + width / (2 * n) * 0,
                y0 + height - yy / maxd * height) for xx, yy in zip(xs, ys)]
        # scipy places leaf i at 5 + 10 i
        pts = [(x0 + ((xx - 5) / 10 + 0.5) * (width / n), y0 + height - yy / maxd * height) for xx, yy in zip(xs, ys)]
        s.polyline(pts, stroke="#666666", sw=0.4)


def kde_contours(x, y, xlim, ylim, levels=7, n=160, bw=0.15):
    from scipy.stats import gaussian_kde
    import contourpy
    k = gaussian_kde(np.vstack([x, y]), bw_method=bw)
    xi = np.linspace(*xlim, n)
    yi = np.linspace(*ylim, n)
    X, Y = np.meshgrid(xi, yi)
    Z = k(np.vstack([X.ravel(), Y.ravel()])).reshape(X.shape)
    gen = contourpy.contour_generator(X, Y, Z)
    lv = np.linspace(Z.max() * 0.04, Z.max() * 0.9, levels)
    return [gen.lines(v) for v in lv]


def stat_box(s: SVG, x, y, lines, size=6, anchor="start"):
    for i, ln in enumerate(lines):
        s.text(x, y + i * (size + 2.2), ln, size=size, anchor=anchor, valign="top")


def chevron(s: SVG, x, y, h=10):
    s.path(f"M{x:.2f},{y - h / 2:.2f} L{x + 4:.2f},{y:.2f} L{x:.2f},{y + h / 2:.2f}", stroke="#9a9a9a", sw=0.9)


def wrap2(label):
    words = label.split(" ")
    best = None
    for k in range(1, len(words)):
        a, b = " ".join(words[:k]), " ".join(words[k:])
        m = max(text_width(a, 6), text_width(b, 6))
        if best is None or m < best[0]:
            best = (m, a, b)
    return (best[1], best[2]) if best else (label, "")


CELL_LEGEND = [("Cancer cell", "#e60000"), ("Lymphocyte", "#009600"), ("Fibroblast", "#0000e6"),
               ("Macrophage", "#9933ff"), ("Neutrophil", "#ff9933"), ("Eosinophil", "#ff66b2"),
               ("Plasmocyte", "#ffff00"), ("Endothelial", "#33cccc"), ("Epithelial, non-cancer", "#006600"),
               ("Mitotic figure", "#66ff66"), ("Apoptotic body", "#66ccff"), ("Red blood cell", "#800000"),
               ("Necrotic cell", "#ffcc99"), ("Smooth muscle", "#663300")]


def fmt_int(n):
    return f"{n:,}"


# ===========================================================================
# Figure 1
# ===========================================================================
def figure1() -> SVG:
    d = load("fig1")
    c = d["cohort"]
    s = SVG(W, 652)
    labels = d["labels"]
    cat_of = d["category_of"]

    # ---------------- A: pipeline ----------------
    s.label(0, 0, "A")
    top = 14
    colw = 73.0
    gap = (W - 4 - 6 * colw) / 5
    xs = [4 + i * (colw + gap) for i in range(6)]
    heads = ["Diagnostic slide", "Tissue compartments", "Cells", "38 named measurements",
             "Statistical layer", "Atlas and API"]
    subs = [
        [f"{fmt_int(c['tcga_slides'])} H&E slides", f"{fmt_int(c['tcga_patients'])} patients, 21 types"],
        ["Tissue model, 5 compartments", "Signed-distance spatial bands"],
        ["HistoPLUS, 9 cell types", ">4 × 10^{9} cells detected"],
        ["Unit, compartment and", "definition for each"],
        ["Effect size, 95% CI, BH-", "adjusted P, power, PH flag"],
        ["histoatlas.com", "Programmatic API"],
    ]
    ih = 54
    for i, x in enumerate(xs):
        s.text(x + colw / 2, top + 2, heads[i], size=7, weight="bold", anchor="middle", valign="top")
        for k, ln in enumerate(subs[i]):
            s.text(x + colw / 2, top + 14 + ih + 6 + k * 8, ln, size=6, anchor="middle", valign="top", fill=INK2)
        if i < 5:
            chevron(s, x + colw + gap / 2 - 2, top + 14 + ih / 2)
    iy = top + 13
    # 1 slide thumbnail
    s.image(xs[0], iy, colw, ih, "luad_thumb", preserve="xMidYMid meet")
    # 2 compartments
    s.image(xs[1], iy, colw, ih, "luad_mask", preserve="xMidYMid meet")
    # 3 tiles
    tw = 35
    s.image(xs[2] + 1, iy + (ih - tw) / 2, tw, tw, "luad_he")
    s.image(xs[2] + colw - tw - 1, iy + (ih - tw) / 2, tw, tw, "luad_ov")
    s.rect(xs[2] + 1, iy + (ih - tw) / 2, tw, tw, stroke="#555", sw=0.4)
    s.rect(xs[2] + colw - tw - 1, iy + (ih - tw) / 2, tw, tw, stroke="#555", sw=0.4)
    s.text(xs[2] + 1 + tw / 2, iy + (ih + tw) / 2 + 2, "H&E", size=6, anchor="middle", valign="top", fill=INK2)
    s.text(xs[2] + colw - 1 - tw / 2, iy + (ih + tw) / 2 + 2, "Cell calls", size=6, anchor="middle", valign="top", fill=INK2)
    # 4 measurement categories
    cats = list(d["categories"].items())
    by = iy + 2
    bh = 8.2
    for k, (cat, n) in enumerate(cats):
        yy = by + k * bh
        s.text(xs[3] + 38, yy + bh / 2, cat, size=6, anchor="end", valign="middle")
        s.rect(xs[3] + 40, yy + 1.4, n * 2.1, bh - 2.8, fill=CATEGORY_COLORS[cat])
        s.text(xs[3] + 42 + n * 2.1, yy + bh / 2, str(n), size=6, valign="middle")
    # 5 statistical layer
    lines = [(fmt_int(c["n_survival_models"]), "Cox models"),
             (fmt_int(c["n_correlations"]), "correlations"),
             (fmt_int(c["n_correlations_significant"]), "significant at FDR 0.05")]
    for k, (num, what) in enumerate(lines):
        yy = iy + 6 + k * 16
        s.text(xs[4] + colw / 2, yy, num, size=8, weight="bold", anchor="middle", valign="top")
        s.text(xs[4] + colw / 2, yy + 8.5, what, size=6, anchor="middle", valign="top", fill=INK2)
    # 6 atlas
    aw = colw
    ah = aw * 668 / 1080
    s.image(xs[5], iy + (ih - ah) / 2, aw, ah, "atlas", preserve="xMidYMid meet")
    s.rect(xs[5], iy + (ih - ah) / 2, aw, ah, stroke="#888", sw=0.4)

    # ---------------- B: correlation matrix ----------------
    y0 = 118
    s.label(0, y0, "B")
    order = d["corr"]["order"]
    feats = [d["features"][i] for i in order]
    M = d["corr"]["matrix"]
    Mo = [[None if i == j else M[i][j] for j in order] for i in order]
    lab_w = 100
    cell = 6.25
    mx = lab_w + 6
    my = y0 + 30
    dendro_top(s, mx, y0 + 6, cell * 38, 21, d["corr"]["dendro"], 38)
    heatmap(s, mx, my, cell, cell, Mo, diverging, 1.0)
    for i, f in enumerate(feats):
        s.rect(mx - 4.2, my + i * cell + 0.4, 3.2, cell - 0.8, fill=CATEGORY_COLORS[cat_of[f]])
        s.text(mx - 5.6, my + (i + 0.5) * cell, labels[f], size=6, anchor="end", valign="middle")
    cbx, cby = mx + cell * 38 + 7, my + 150
    s.text(cbx, cby - 5, "Spearman ρ", size=6.5)
    colorbar_v(s, cbx, cby, 5, 80, diverging_cb(1.0), -1, 1, [-1, -0.5, 0, 0.5, 1])
    # category legend under the matrix
    lx = mx
    ly = my + cell * 38 + 9
    for cat in CATEGORY_COLORS:
        lx = legend_item(s, lx, ly, CATEGORY_COLORS[cat], cat, size=6) + 7

    # ---------------- C: UMAP ----------------
    cx0 = 372
    s.label(cx0 - 10, y0, "C")
    ux, uy, uct = np.array(d["umap"]["x"]), np.array(d["umap"]["y"]), d["umap"]["ct"]
    xl, yl = (ux.min() - 0.6, ux.max() + 0.6), (uy.min() - 0.6, uy.max() + 0.6)
    pw = W - cx0 - 2
    ph = pw * (yl[1] - yl[0]) / (xl[1] - xl[0])
    py = y0 + 16
    sx = Lin(xl[0], xl[1], cx0, cx0 + pw)
    sy = Lin(yl[0], yl[1], py + ph, py)
    for lv in kde_contours(ux, uy, xl, yl):
        for seg in lv:
            if len(seg) > 3:
                s.polyline([(sx(a), sy(b)) for a, b in seg], stroke="#b0b0b0", sw=0.3)
    pts = []
    for a, b, ct in zip(ux, uy, uct):
        pts.append(f'<circle cx="{sx(a):.1f}" cy="{sy(b):.1f}" r="0.55" fill="{CANCER_COLORS[ct]}"/>')
    s.add('<g fill-opacity="0.85">' + "".join(pts) + "</g>")
    placed = []
    for ct in d["umap"]["labelled"]:
        a, b = d["umap"]["centroids"][ct]
        bw, bx, by = text_width(ct, 6, "bold") / 2 + 1, sx(a), sy(b)
        if any(abs(bx - px) < bw + pw_ and abs(by - py_) < 7 for px, py_, pw_ in placed):
            continue
        placed.append((bx, by, bw))
        s.text(bx, by, ct, size=6, weight="bold", anchor="middle", valign="middle", halo="#ffffff")
    # axis indicator
    ox, oy = cx0 + 2, py + ph - 2
    s.line(ox, oy, ox + 16, oy, sw=0.5)
    s.line(ox, oy, ox, oy - 16, sw=0.5)
    s.text(ox + 1, oy + 2, "UMAP1", size=5.5 if False else 6, valign="top", fill=INK2)
    s.text(ox - 2, oy - 1, "UMAP2", size=6, rotate=-90, fill=INK2)
    # legend
    cts = sorted(CANCER_COLORS)
    cts.remove("HNSCC")
    lx0, ly0 = cx0 + 2, py + ph + 18
    for k, ct in enumerate(cts):
        col, row = k % 4, k // 4
        legend_item(s, lx0 + col * 30, ly0 + row * 8.2, CANCER_COLORS[ct], ct, kind="dot", size=6)
    s.text(cx0 + pw / 2, ly0 + 6 * 8.2 + 4, f"n = {fmt_int(len(ux))} slides", size=6, anchor="middle",
           valign="top", fill=INK2)

    # ---------------- D/E: clusters ----------------
    y1 = 438
    s.label(0, y1, "D")
    cl = d["clusters"]
    rows = cl["profile_clusters"]
    rh = 9.6
    ry = y1 + 22
    bar_x, bar_w = 52, 100
    s.text(bar_x + bar_w / 2, y1 + 4, "Cancer-type composition", size=7, anchor="middle", valign="top")
    for i, cid in enumerate(rows):
        yy = ry + i * rh
        s.text(bar_x - 3, yy + rh / 2, f"C{cid} ({fmt_int(cl['n'][str(cid)])})", size=6, anchor="end", valign="middle")
        comp = cl["composition"][str(cid)]
        acc = 0.0
        for ct in sorted(comp):
            v = comp[ct]
            s.rect(bar_x + acc * bar_w, yy + 1.2, v * bar_w, rh - 2.4, fill=CANCER_COLORS[ct], stroke="#ffffff", sw=0.25)
            if v >= 0.2:
                s.text(bar_x + (acc + v / 2) * bar_w, yy + rh / 2, ct, size=5.5 if False else 6, anchor="middle",
                       valign="middle", fill="#ffffff" if ct in ("CHOL", "COAD", "HNSC", "LUSC", "MESO", "OV", "BRCA", "PRAD", "LUAD") else INK)
            acc += v
        # survival column
        sv = [r for r in cl["survival"].get(str(cid), []) if r["valid"]]
        if sv:
            r0 = sv[0]
            sx0 = bar_x + bar_w + 13
            if r0["sig_adj"]:
                if r0["hr"] < 1:
                    triangle(s, sx0, yy + rh / 2, 2.6, BLUE, BLUE)  # drawn then flipped below
                    s.els.pop()
                    s.path(f"M{sx0 - 2.6:.2f},{yy + rh / 2 - 2:.2f} L{sx0 + 2.6:.2f},{yy + rh / 2 - 2:.2f} "
                           f"L{sx0:.2f},{yy + rh / 2 + 2.6:.2f} Z", fill=BLUE, stroke=BLUE, sw=0.4)
                else:
                    triangle(s, sx0, yy + rh / 2, 2.6, VERMILLION, VERMILLION)
                s.text(sx0 + 4.5, yy + rh / 2, f"{r0['hr']:.2f}", size=6, valign="middle")
            else:
                s.line(sx0 - 2, yy + rh / 2, sx0 + 2, yy + rh / 2, stroke=MUTED, sw=0.7)
    axis_bottom(s, Lin(0, 1, bar_x, bar_x + bar_w), ry + 10 * rh + 1, [0, 0.5, 1], title="Proportion of cluster")
    s.text(bar_x + bar_w + 13, ry - 3, "OS HR", size=6, anchor="middle", fill=INK2)

    # E
    ex = 196
    s.label(ex - 12, y1, "E")
    pf = cl["profile_features"]
    cw = (W - ex - 34) / 38
    s.text(ex + cw * 19, y1 + 4, "Mean measurement value per cluster (z-score)", size=7, anchor="middle", valign="top")
    Mz = [cl["profile"][str(cid)] for cid in rows]
    heatmap(s, ex, ry, cw, rh, Mz, diverging, 2.0)
    for j, f in enumerate(pf):
        s.rect(ex + j * cw + 0.4, ry - 4.4, cw - 0.8, 3.2, fill=CATEGORY_COLORS[cat_of[f]])
        s.text(ex + (j + 0.5) * cw, ry + 10 * rh + 3, labels[f], size=6, anchor="end", valign="middle", rotate=-90)
    for i, cid in enumerate(rows):
        s.text(ex - 2, ry + (i + 0.5) * rh, f"C{cid}", size=6, anchor="end", valign="middle")
    colorbar_v(s, W - 28, ry + 4, 5, 80, diverging_cb(2.0), -2, 2, [-2, -1, 0, 1, 2], title="z-score")
    return s



PROGRAM_SHORT = {"program_1": "Immune", "program_2": "Stromal", "program_3": "Atypia",
                 "program_4": "Density", "program_5": "Myeloid", "program_6": "Fibroblast"}


def hallmark(name):
    n = name.replace("HALLMARK_", "").replace("_", " ").lower()
    fixes = {"tnfa signaling via nfkb": "TNFα via NF-κB", "il6 jak stat3 signaling": "IL6-JAK-STAT3",
             "il2 stat5 signaling": "IL2-STAT5", "pi3k akt mtor signaling": "PI3K-AKT-mTOR",
             "mtorc1 signaling": "mTORC1", "kras signaling up": "KRAS up", "kras signaling dn": "KRAS down",
             "epithelial mesenchymal transition": "EMT", "interferon gamma response": "IFN-γ response",
             "interferon alpha response": "IFN-α response", "myc targets v1": "MYC targets v1",
             "myc targets v2": "MYC targets v2", "e2f targets": "E2F targets", "g2m checkpoint": "G2M checkpoint",
             "dna repair": "DNA repair", "uv response up": "UV response up", "uv response dn": "UV response down",
             "tgf beta signaling": "TGF-β", "wnt beta catenin signaling": "WNT-β-catenin",
             "p53 pathway": "p53 pathway", "pancreas beta cells": "Pancreas β cells",
             "reactive oxygen species pathway": "ROS pathway", "unfolded protein response": "Unfolded protein resp.",
             "oxidative phosphorylation": "Oxidative phosphorylation", "estrogen response early": "Estrogen response early",
             "estrogen response late": "Estrogen response late", "notch signaling": "NOTCH",
             "hedgehog signaling": "Hedgehog"}
    if n in fixes:
        return fixes[n]
    return n[0].upper() + n[1:]


def violin(s, cx, sy, grid, dens, half_w, color, q):
    m = max(dens)
    left = [(cx - v / m * half_w, sy(g)) for g, v in zip(grid, dens)]
    right = [(cx + v / m * half_w, sy(g)) for g, v in zip(grid, dens)][::-1]
    d = "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in left + right) + " Z"
    s.path(d, fill=color, fill_opacity=0.28, stroke=color, sw=0.4)
    s.line(cx, sy(q[0]), cx, sy(q[4]), stroke=INK, sw=0.5)
    s.rect(cx - 2.6, sy(q[3]), 5.2, sy(q[1]) - sy(q[3]), fill=color, stroke=INK, sw=0.4)
    s.line(cx - 2.6, sy(q[2]), cx + 2.6, sy(q[2]), stroke="#ffffff", sw=0.9)


# ===========================================================================
# Figure 2: programs
# ===========================================================================
def figure2() -> SVG:
    d = load("fig2")
    s = SVG(W, 452)
    progs = d["programs"]
    # A loadings
    s.label(0, 0, "A")
    feats = d["feature_order"]
    cell, cw = 6.25, 15
    mx, my = 104, 44
    L = [d["loadings"][f] for f in feats]
    heatmap(s, mx, my, cw, cell, L, diverging, 0.5)
    for i, f in enumerate(feats):
        s.text(mx - 2.5, my + (i + 0.5) * cell, d["labels"][f], size=6, anchor="end", valign="middle")
    for j, p in enumerate(progs):
        x = mx + (j + 0.5) * cw
        s.text(x, my - 3, f"P{j + 1} {PROGRAM_SHORT[p]}", size=6, rotate=-55)
    cbx = mx + 6 * cw + 6
    s.text(cbx, my + 2, "Loading", size=6.5, valign="top")
    colorbar_v(s, cbx, my + 12, 5, 70, diverging_cb(0.5), -0.5, 0.5, [-0.5, -0.25, 0, 0.25, 0.5])
    s.text(mx, my + 38 * cell + 9, f"Sparse PCA on {fmt_int(d['n_tcga'])} TCGA patients", size=6, fill=INK2, valign="top")

    # B distributions
    bx0 = 238
    s.label(bx0 - 8, 0, "B")
    lx = bx0 + 20
    lx = legend_item(s, lx, 6, BLUE, f"TCGA (n = {fmt_int(d['n_tcga'])})") + 10
    legend_item(s, lx, 6, ORANGE, f"CPTAC, projected (n = {d['n_cptac']})")
    pw_, ph_ = 94, 70
    for k, p in enumerate(progs):
        col, row = k % 2, k // 2
        x0 = bx0 + 30 + col * (pw_ + 34)
        y0 = 26 + row * (ph_ + 30)
        dd = d["dist"][p]
        lo, hi = min(dd["grid"]), max(dd["grid"])
        sy = Lin(lo, hi, y0 + ph_, y0)
        tk = nice_ticks(lo, hi, 4)
        axis_left(s, sy, x0, tk, y0=y0 + ph_, y1=y0)
        violin(s, x0 + pw_ * 0.3, sy, dd["grid"], dd["kde_tcga"], 16, BLUE, dd["q_tcga"])
        violin(s, x0 + pw_ * 0.72, sy, dd["grid"], dd["kde_cptac"], 16, ORANGE, dd["q_cptac"])
        s.text(x0 + 4, y0 - 9, f"P{k + 1} {PROGRAM_SHORT[p]}", size=7, weight="bold")
        pv = dd["ks_p"]
        ptxt = "P < 10^{−10}" if pv < 1e-10 else f"P = {sci(pv) if pv < 1e-3 else f'{pv:.2g}'}"
        s.text(x0 + pw_, y0 - 9, f"D = {dd['ks_D']:.3f}, {ptxt}", size=6, anchor="end", fill=INK2)
        if col == 0:
            s.text(x0 - 17, y0 + ph_ / 2, "Program score", size=6.5, anchor="middle", rotate=-90)

    # C program x pathway
    y2 = 300
    s.label(0, y2, "C")
    paths = d["pathways"]
    cw2 = (W - 60 - 30) / len(paths)
    rh = 9.5
    cx0, cy0 = 60, y2 + 8
    M = [d["pathway_rho"][p] for p in progs]
    heatmap(s, cx0, cy0, cw2, rh, M, diverging, 0.6)
    for i, p in enumerate(progs):
        s.text(cx0 - 3, cy0 + (i + 0.5) * rh, f"P{i + 1} {PROGRAM_SHORT[p]}", size=6, anchor="end", valign="middle")
        for j in range(len(paths)):
            if d["pathway_sig"][p][j]:
                v = d["pathway_rho"][p][j]
                s.circle(cx0 + (j + 0.5) * cw2, cy0 + (i + 0.5) * rh, 0.75,
                         fill="#ffffff" if abs(v) > 0.35 else INK)
    for j, w in enumerate(paths):
        s.text(cx0 + (j + 0.5) * cw2, cy0 + 6 * rh + 3, hallmark(w), size=6, anchor="end", valign="middle", rotate=-90)
    cbx = cx0 + len(paths) * cw2 + 6
    s.text(cbx, cy0 - 3, "ρ", size=7)
    colorbar_v(s, cbx, cy0 + 1, 5, 55, diverging_cb(0.6), -0.6, 0.6, [-0.6, 0, 0.6])
    return s


# ===========================================================================
# Figure 3: immune topology
# ===========================================================================
def figure3() -> SVG:
    d = load("fig3")
    s = SVG(W, 492)
    ITL, STL = "intratumoral_lymphocyte_density", "stromal_lymphocyte_density"
    COL = {ITL: BLUE, STL: VERMILLION}
    # A forest
    s.label(0, 0, "A")
    rows = {}
    for r_ in d["forest"]:
        rows.setdefault(r_["ct"], {})[r_["feature"]] = r_
    cts = sorted(c for c in rows if c != "PANCAN" and any(v["valid"] for v in rows[c].values()))
    order = cts + ["PANCAN"]
    x0, x1 = 36, 206
    y0 = 22
    rh = 11.0
    sc = Log(0.35, 3.0, x0, x1)
    ypos = {ct: y0 + i * rh + (6 if ct == "PANCAN" else 0) for i, ct in enumerate(order)}
    yend = ypos["PANCAN"] + rh * 0.8
    s.rect(x0, y0 - 6, sc(1) - x0, yend - y0 + 6, fill="#eef4fa")
    s.rect(sc(1), y0 - 6, x1 - sc(1), yend - y0 + 6, fill="#fbf1ea")
    s.text((x0 + sc(1)) / 2, y0 - 9, "Lower hazard", size=6, anchor="middle", fill=INK2)
    s.text((sc(1) + x1) / 2, y0 - 9, "Higher hazard", size=6, anchor="middle", fill=INK2)
    s.line(sc(1), y0 - 6, sc(1), yend, stroke="#777", sw=0.5, dash="2,1.5")
    s.line(x0, ypos["PANCAN"] - rh * 0.55, x1, ypos["PANCAN"] - rh * 0.55, stroke="#bbbbbb", sw=0.4)
    s.text(x1 + 4, y0 - 9, "n", size=6, fill=INK2, weight="bold")
    for ct in order:
        yy = ypos[ct]
        s.text(x0 - 3, yy + 1.5, "Pan-cancer" if ct == "PANCAN" else ct, size=6, anchor="end", valign="middle",
               weight="bold" if ct == "PANCAN" else "normal")
        n = next(v["n"] for v in rows[ct].values())
        s.text(x1 + 4, yy + 1.5, fmt_int(n), size=6, valign="middle", fill=INK2)
        for k, f in enumerate([ITL, STL]):
            r_ = rows[ct].get(f)
            if not r_ or not r_["valid"]:
                continue
            yo = yy - 1.8 + k * 3.6 + 1.5
            lo, hi = max(r_["lo"], 0.35), min(r_["hi"], 3.0)
            s.line(sc(lo), yo, sc(hi), yo, stroke=COL[f], sw=0.7)
            strong = r_["badge"] in ("moderate", "strong")
            fill = COL[f] if strong else "#ffffff"
            if f == ITL:
                s.circle(sc(r_["hr"]), yo, 2.0, fill=fill, stroke=COL[f], sw=0.7)
            else:
                diamond(s, sc(r_["hr"]), yo, 2.3, fill, COL[f], 0.7)
    axis_bottom(s, sc, yend + 2, [0.4, 0.5, 0.7, 1, 1.5, 2, 3], x0=x0, x1=x1,
                labels=["0.4", "0.5", "0.7", "1", "1.5", "2", "3"], title="Hazard ratio, overall survival (95% CI)")
    ly = yend + 34
    lx = legend_item(s, 8, ly, BLUE, "Intratumoral lymphocyte density", kind="dot", size=6) + 8
    legend_item(s, lx, ly, VERMILLION, "Stromal lymphocyte density", kind="diamond", size=6)
    lx = legend_item(s, 8, ly + 9, INK2, "Filled: moderate or strong evidence", kind="dot", size=6) + 8
    legend_item(s, lx, ly + 9, INK2, "Open: suggestive or insufficient", kind="dot", size=6, filled=False)

    # B Kaplan-Meier
    bx = 272
    s.label(bx - 18, 0, "B")
    km = d["km"]
    kx0, kx1, ky0, ky1 = bx + 18, W - 6, 18, 168
    sx = Lin(0, 120, kx0, kx1)
    sy = Lin(0, 1, ky1, ky0)
    axis_left(s, sy, kx0, [0, 0.2, 0.4, 0.6, 0.8, 1.0], title="Overall survival probability")
    axis_bottom(s, sx, ky1, [0, 20, 40, 60, 80, 100, 120], title="Time (months)", title_gap=10)
    KC = {"High": BLUE, "Low": ORANGE}
    for g in ("Low", "High"):
        k = km[g]
        t = [v for v in k["t"]]
        keep = [i for i, v in enumerate(t) if v <= 120]
        # confidence band (step)
        up, dn = [], []
        for ii, i in enumerate(keep):
            tn = t[keep[ii + 1]] if ii + 1 < len(keep) else 120
            up += [(sx(t[i]), sy(k["hi"][i])), (sx(tn), sy(k["hi"][i]))]
            dn += [(sx(t[i]), sy(k["lo"][i])), (sx(tn), sy(k["lo"][i]))]
        dpath = "M" + " L".join(f"{a:.2f},{b:.2f}" for a, b in up + dn[::-1]) + " Z"
        s.path(dpath, fill=KC[g], fill_opacity=0.14)
        pts = []
        for ii, i in enumerate(keep):
            tn = t[keep[ii + 1]] if ii + 1 < len(keep) else 120
            pts += [(sx(t[i]), sy(k["s"][i])), (sx(tn), sy(k["s"][i]))]
        s.polyline(pts, stroke=KC[g], sw=1.0)
        for ct_, cs_ in zip(k["cens_t"], k["cens_s"]):
            if ct_ <= 120:
                s.line(sx(ct_), sy(cs_) - 1.6, sx(ct_), sy(cs_) + 1.6, stroke=KC[g], sw=0.5)
    itl = next(r_ for r_ in d["forest"] if r_["ct"] == "BRCA" and r_["feature"] == ITL)
    stat_box(s, kx0 + 6, ky1 - 58, [f"HR = {itl['hr']:.2f} [{itl['lo']:.2f}, {itl['hi']:.2f}]",
                                   f"P_{{adj}} = {itl['p_adj']:.3f}, n = {itl['n']}"])
    s.text(kx0 + 6, ky1 - 39, "(adjusted Cox model, continuous measurement)", size=6, valign="top", fill=INK2)
    legend_item(s, kx0 + 6, ky1 - 21, BLUE, f"Above median (n = {km['High']['n']})", kind="line", size=6)
    legend_item(s, kx0 + 6, ky1 - 12, ORANGE, f"Below median (n = {km['Low']['n']})", kind="line", size=6)
    s.text((kx0 + kx1) / 2, ky0 - 8, "Breast carcinoma, intratumoral lymphocyte density", size=7, anchor="middle")
    ry = ky1 + 30
    s.text(kx0 - 9, ry - 1, "At risk", size=6, anchor="end", weight="bold", fill=INK2)
    for j, g in enumerate(("High", "Low")):
        yy = ry + 8 + j * 8
        s.text(kx0 - 9, yy, "Above" if g == "High" else "Below", size=6, anchor="end", valign="middle", fill=KC[g])
        for tt in [0, 20, 40, 60, 80, 100, 120]:
            s.text(sx(tt), yy, str(km[g]["risk"][str(tt)]), size=6, anchor="middle", valign="middle")

    # C scatter
    y2 = 302
    s.label(0, y2, "C")
    sc_ = d["scatter"]
    cx0, cx1, cy0, cy1 = 36, 206, y2 + 22, y2 + 162
    sx = Lin(0, 1, cx0 + 3, cx1)
    sy = Lin(0, 1, cy1 - 3, cy0)
    tk = [0, 0.25, 0.5, 0.75, 1]
    tl = ["0", "25", "50", "75", "100"]
    axis_left(s, sy, cx0, tk, labels=tl, y0=cy1, y1=cy0, title="*CD8A* expression, percentile rank")
    axis_bottom(s, sx, cy1, tk, labels=tl, x0=cx0, x1=cx1,
                title="Tumor-lymphocyte NN distance at front, percentile rank", title_gap=10)
    pts = [f'<circle cx="{sx(a):.1f}" cy="{sy(b):.1f}" r="1.1"/>' for a, b in zip(sc_["x"], sc_["y"])]
    s.add(f'<g fill="{BLUE}" fill-opacity="0.4">' + "".join(pts) + "</g>")
    s.line(sx(0), sy(sc_["intercept"]), sx(1), sy(sc_["intercept"] + sc_["slope"]), stroke=VERMILLION, sw=0.9)
    mn = lambda v: f"{v:.2f}".replace("-", "−")
    s.text((cx0 + cx1) / 2, cy0 - 3, f"ρ = {mn(sc_['rho'])} [{mn(sc_['lo'])}, {mn(sc_['hi'])}], "
           f"P_{{adj}} = {sci(sc_['p_adj'])}, n = {sc_['n']}", size=6, anchor="middle", fill=INK2)
    s.text((cx0 + cx1) / 2, cy0 - 12, "Breast carcinoma, unadjusted", size=7, anchor="middle")

    # D genes
    s.label(bx - 18, y2, "D")
    genes = sorted(d["genes"], key=lambda g: g["rho"], reverse=True)
    dx0, dx1 = bx + 30, W - 8
    gy0 = y2 + 14
    gh = 10.4
    sx = Lin(-0.45, 0.75, dx0, dx1)
    CHECK = {"TIGIT", "PDCD1", "CTLA4", "CD274", "LAG3", "HAVCR2"}
    for i, g in enumerate(genes):
        yy = gy0 + i * gh
        col = BLUE if g["rho"] > 0 else ORANGE
        x_a, x_b = sx(0), sx(g["rho"])
        s.rect(min(x_a, x_b), yy + 2, abs(x_b - x_a), gh - 4, fill=col, opacity=0.85)
        s.line(sx(g["lo"]), yy + gh / 2, sx(g["hi"]), yy + gh / 2, stroke=INK, sw=0.5)
        for e in (g["lo"], g["hi"]):
            s.line(sx(e), yy + gh / 2 - 1.5, sx(e), yy + gh / 2 + 1.5, stroke=INK, sw=0.5)
        s.text(dx0 - 3, yy + gh / 2, f"*{g['gene']}*", size=6, anchor="end", valign="middle",
               weight="bold" if g["gene"] in CHECK else "normal")
    gy1 = gy0 + len(genes) * gh
    s.line(sx(0), gy0, sx(0), gy1, stroke="#777", sw=0.5, dash="2,1.5")
    axis_bottom(s, sx, gy1 + 2, [-0.4, -0.2, 0, 0.2, 0.4, 0.6], title="Spearman ρ with intratumoral lymphocyte density",
                title_gap=10)
    s.text((dx0 + dx1) / 2, y2 + 7, f"Breast carcinoma, n = {genes[0]['n']}; bold, immune checkpoints",
           size=6.5, anchor="middle")
    return s


# ===========================================================================
# Figure 4: transfer to CPTAC
# ===========================================================================
def density_panel(s, x0, y0, size, hist, lim, xlabel, ylabel, ticks):
    sx = Lin(-lim, lim, x0, x0 + size)
    sy = Lin(-lim, lim, y0 + size, y0)
    nb, L = hist["nb"], hist["lim"]
    step = 2 * L / nb
    mx = math.log10(hist["max"] + 1)
    for i, j, c in hist["cells"]:
        xa = -L + i * step
        ya = -L + j * step
        t = 0.15 + 0.85 * math.log10(c + 1) / mx
        s.rect(sx(xa), sy(ya + step), sx(xa + step) - sx(xa) + 0.1, sy(ya) - sy(ya + step) + 0.1, fill=sequential(t))
    s.line(sx(-lim), sy(-lim), sx(lim), sy(lim), stroke="#777", sw=0.5, dash="2,1.5")
    s.line(sx(0), y0, sx(0), y0 + size, stroke=GRID, sw=0.4)
    s.line(x0, sy(0), x0 + size, sy(0), stroke=GRID, sw=0.4)
    axis_left(s, sy, x0, ticks, title=ylabel)
    axis_bottom(s, sx, y0 + size, ticks, title=xlabel, title_gap=10)
    s.rect(x0, y0, size, size, stroke=AXIS, sw=0.4)
    return sx, sy


def figure4() -> SVG:
    d = load("fig4")
    s = SVG(W, 414)
    # A SMD heatmap
    s.label(0, 0, "A")
    feats = d["features"]
    cancers = d["cancers"]
    cell, cw = 6.4, 17.5
    mx, my = 104, 44
    M = [[d["smd_median_tcgaSD"][c][i] for c in cancers] for i in range(len(feats))]
    heatmap(s, mx, my, cw, cell, M, diverging, 2.0)
    for i, f in enumerate(feats):
        s.rect(mx - 4.2, my + i * cell + 0.4, 3.2, cell - 0.8, fill=CATEGORY_COLORS[d["category_of"][f]])
        s.text(mx - 5.6, my + (i + 0.5) * cell, d["labels"][f], size=6, anchor="end", valign="middle")
        for j, c in enumerate(cancers):
            v = M[i][j]
            if v is not None and abs(v) > 1:
                s.circle(mx + (j + 0.5) * cw, my + (i + 0.5) * cell, 0.9, fill="#ffffff" if abs(v) > 1.5 else INK)
    for j, c in enumerate(cancers):
        s.text(mx + (j + 0.5) * cw - 1, my - 12, c, size=6, rotate=-45)
        s.text(mx + (j + 0.5) * cw, my - 4, f"{d['within_1sd'][c]}", size=6, anchor="middle", fill=INK2)
    s.text(mx - 5.6, my - 4, "Measurements within 1 SD (of 38)", size=6, anchor="end", fill=INK2)
    cbx = mx + 5 * cw + 5
    s.text(cbx - 1, my + 1, "Std.", size=6.5, valign="top")
    s.text(cbx - 1, my + 9, "diff. d", size=6.5, valign="top")
    colorbar_v(s, cbx, my + 20, 5, 70, diverging_cb(2.0), -2, 2, [-2, -1, 0, 1, 2])
    s.circle(cbx + 2.5, my + 100, 0.9, fill=INK)
    s.text(cbx + 6, my + 100, "|d| > 1", size=6, valign="middle")

    # B transfer density
    bx = 228
    s.label(bx, 0, "B")
    t = d["transfer"]
    size = 98
    density_panel(s, bx + 32, 16, size, t["hist"], 0.8, "TCGA Spearman ρ", "CPTAC Spearman ρ",
                  [-0.8, -0.4, 0, 0.4, 0.8])
    s.text(bx + 32 + size / 2, 10, "Measurement–gene correlations", size=6.5, anchor="middle")
    stat_box(s, bx + 35, 19, [f"r = {t['r']:.2f}", f"n = {fmt_int(t['n'])}"])
    # C protein density
    cx = 362
    s.label(cx, 0, "C")
    pr = d["protein"]
    sx, sy = density_panel(s, cx + 22, 16, size, pr["hist"], 0.8, "mRNA Spearman ρ", "Protein Spearman ρ",
                           [-0.8, -0.4, 0, 0.4, 0.8])
    pts = "".join(f'<circle cx="{sx(a):.1f}" cy="{sy(b):.1f}" r="1.0"/>' for a, b in zip(pr["both_x"], pr["both_y"]))
    s.add(f'<g fill="{VERMILLION}" fill-opacity="0.75" stroke="#ffffff" stroke-width="0.2">{pts}</g>')
    s.text(cx + 22 + size / 2, 10, "CPTAC, mRNA and protein", size=6.5, anchor="middle")
    stat_box(s, cx + 25, 19, [f"n = {fmt_int(pr['n'])}"])
    stat_box(s, cx + 22 + size - 3, 16 + size - 20, [f"Both significant: {pr['n_both']}",
                                                      f"Same sign: {pr['concordant']}/{pr['n_both']}"], anchor="end")
    # shared density legend
    lx, ly = bx + 32, 152
    s.text(lx, ly, "Pairs per bin", size=6, valign="middle", fill=INK2)
    for k in range(6):
        s.rect(lx + 42 + k * 9, ly - 3, 9, 6, fill=sequential(0.15 + 0.85 * k / 5))
    s.text(lx + 42, ly + 6, "1", size=6, anchor="middle", valign="top")
    s.text(lx + 96, ly + 6, "max", size=6, anchor="middle", valign="top")
    legend_item(s, lx + 120, ly, VERMILLION, "Significant in mRNA and protein", kind="dot", size=6)

    # D triangulation
    y3 = 176
    s.label(bx, y3, "D")
    rows = d["triangulation"]
    cols = ["TCGA mRNA", "CPTAC mRNA", "CPTAC protein", "TCGA survival"]
    gx0 = bx + 150
    gw = (W - gx0 - 6) / 4
    gy0 = y3 + 30
    rh = 15
    for j, c in enumerate(cols):
        a, b = c.split(" ")
        s.text(gx0 + (j + 0.5) * gw, gy0 - 14, a, size=6, anchor="middle", weight="bold")
        s.text(gx0 + (j + 0.5) * gw, gy0 - 6, b, size=6, anchor="middle", weight="bold")
    prev = None
    yy = gy0
    for r_ in rows:
        if r_["axis"] != prev:
            if prev is not None:
                yy += 5
                s.line(bx + 10, yy - rh / 2 - 2, W - 4, yy - rh / 2 - 2, stroke=GRID, sw=0.4)
            s.text(bx + 10, yy, r_["axis"], size=6.5, weight="bold", valign="middle")
            s.text(bx + 10, yy + 8, r_["label"], size=6, valign="middle", fill=INK2)
            prev = r_["axis"]
        s.text(gx0 - 6, yy, f"*{r_['gene']}*", size=6.5, anchor="end", valign="middle")
        for j, sig in enumerate(r_["sig"]):
            s.circle(gx0 + (j + 0.5) * gw, yy, 3.0, fill=GREEN if sig else "#ffffff", stroke=GREEN if sig else "#9a9a9a", sw=0.7)
        yy += rh
    ly = yy + 6
    lx = legend_item(s, gx0 - 20, ly, GREEN, "FDR < 0.05", kind="dot", size=6) + 10
    legend_item(s, lx, ly, "#9a9a9a", "Not significant", kind="dot", size=6, filled=False)
    return s


# ===========================================================================
# Figure 5: added value
# ===========================================================================
def figure5() -> SVG:
    d = load("fig5")
    s = SVG(W, 188)
    # A forest
    s.label(0, 0, "A")
    fr = d["forest"]
    x0, x1 = 62, 150
    sc = Log(0.5, 4.0, x0, x1)
    y0 = 24
    rh = 38
    s.line(sc(1), y0 - 6, sc(1), y0 + rh * len(fr) - 6, stroke="#777", sw=0.5, dash="2,1.5")
    for i, r_ in enumerate(fr):
        yy = y0 + i * rh
        l1, l2 = wrap2(r_["label"])
        s.text(x0 - 4, yy - 2, l1, size=6, anchor="end", valign="middle")
        s.text(x0 - 4, yy + 6, l2, size=6, anchor="end", valign="middle")
        s.text(x0 - 4, yy + 14, f"{r_['ct']}, n = {r_['n']}", size=6, anchor="end", valign="middle", fill=INK2)
        for k, (key, col) in enumerate((("base", BLUE), ("adj", VERMILLION))):
            hr, lo, hi, p = r_[key]
            yo = yy + 2 + k * 9
            s.line(sc(max(lo, 0.5)), yo, sc(min(hi, 4)), yo, stroke=col, sw=0.7)
            if key == "base":
                s.circle(sc(hr), yo, 2.1, fill=col, stroke=col)
            else:
                triangle(s, sc(hr), yo, 2.4, col, col)
            s.text(x1 + 3, yo, f"{hr:.2f}", size=6, valign="middle", fill=col)
    axis_bottom(s, sc, y0 + rh * len(fr) - 4, [0.5, 1, 2, 4], labels=["0.5", "1", "2", "4"],
                title="Hazard ratio (95% CI)", title_gap=10)
    ly = y0 + rh * len(fr) + 28
    legend_item(s, 4, ly, BLUE, "Clinical covariates", kind="dot", size=6)
    triangle(s, 6.6, ly + 9, 2.4, VERMILLION, VERMILLION)
    s.text(11.5, ly + 9, "Clinical + matched bulk RNA covariates", size=6, valign="middle")

    # B c-index
    bx = 186
    s.label(bx, 0, "B")
    ci = d["cindex"]
    sx = Lin(0.732, 0.752, bx + 66, bx + 160)
    y0b = 24
    rhb = 30
    MK = [("Clinical", "#9a9a9a"), ("+ RNA", BLUE), ("+ histomics", ORANGE), ("+ RNA + histomics", VERMILLION)]
    for i, r_ in enumerate(ci):
        yy = y0b + i * rhb
        l1, l2 = wrap2(r_["label"])
        s.text(bx + 62, yy, l1, size=6, anchor="end", valign="middle")
        s.text(bx + 62, yy + 8, l2, size=6, anchor="end", valign="middle")
        s.text(bx + 62, yy + 16, f"RNA: *{r_['rna']}*", size=6, anchor="end", valign="middle", fill=INK2)
        s.line(sx(min(r_["c"])), yy + 8, sx(max(r_["c"])), yy + 8, stroke=GRID, sw=0.8)
        for k, (nm, col) in enumerate(MK):
            v = r_["c"][k]
            s.circle(sx(v), yy + 8, 2.2, fill=col, stroke="#ffffff", sw=0.3)
    axis_bottom(s, sx, y0b + rhb * len(ci) - 2, [0.735, 0.74, 0.745, 0.75], labels=["0.735", "0.740", "0.745", "0.750"],
                title="Harrell's C, breast carcinoma", title_gap=10)
    ly = y0b + rhb * len(ci) + 26
    lx = bx + 4
    for k, (nm, col) in enumerate(MK):
        legend_item(s, lx + (k % 2) * 70, ly + (k // 2) * 9, col, nm, kind="dot", size=6)
    s.text(bx + 112, 10, f"n = {ci[0]['n']}, {ci[0]['events']} events", size=6, anchor="middle", fill=INK2)

    # C partial correlations
    cx = 360
    s.label(cx, 0, "C")
    pc = d["partial"]
    size = 104
    sx, sy = density_panel(s, cx + 26, 16, size, pc["hist"], 0.8, "Protein ρ (unadjusted)",
                           "Protein ρ | mRNA (partial)", [-0.8, -0.4, 0, 0.4, 0.8])
    pts = "".join(f'<circle cx="{sx(a):.1f}" cy="{sy(b):.1f}" r="1.1"/>' for a, b in zip(pc["sig_x"], pc["sig_y"]))
    s.add(f'<g fill="{VERMILLION}" fill-opacity="0.8" stroke="#ffffff" stroke-width="0.2">{pts}</g>')
    for lab in pc["labels"]:
        if lab["gene"] == "VIM":
            s.text(sx(lab["x"]) + 1, sy(lab["y"]) - 4, "VIM", size=6, anchor="end", halo="#ffffff")
        if lab["gene"] == "NF2":
            s.text(sx(lab["x"]) + 3, sy(lab["y"]) + 3, "NF2", size=6, valign="top", halo="#ffffff")
    stat_box(s, cx + 29, 19, [f"n = {fmt_int(pc['n'])}", f"FDR < 0.05: {pc['n_sig']}",
                              f"Retain > half: {pc['retained_half'] * 100:.0f}%"])
    return s


# ===========================================================================
# Figure 6: provenance
# ===========================================================================
def figure6() -> SVG:
    d = load("fig6")
    s = SVG(W, 412)
    # A map
    s.label(0, 0, "A")
    mw, mh = d["mask_size"]
    aw = 236
    ah = aw * mh / mw
    ax0, ay0 = 6, 16
    s.image(ax0, ay0, aw, ah, "brca_mask", preserve="none")
    s.text(ax0 + aw / 2, 8, "Tissue compartment map, breast carcinoma (TCGA-A1-A0SE)", size=6.5, anchor="middle")
    TX, TY = d["max_tile"]

    def tile_xy(t):
        return ax0 + (t["tileX"] + 0.5) / TX * aw, ay0 + (t["tileY"] + 0.5) / TY * ah

    for grp, col, num in (("tiles_intratumoral", BLUE, "1"), ("tiles_stromal", VERMILLION, "2")):
        for k, t in enumerate(d[grp]):
            x, y = tile_xy(t)
            s.circle(x, y, 3.3 if k == 0 else 2.2, fill="none", stroke=col, sw=1.0)
        x, y = tile_xy(d[grp][0])
        s.circle(x + 8, y - 8, 4.2, fill=col, stroke="#ffffff", sw=0.6)
        s.text(x + 8, y - 8, num, size=6, weight="bold", fill="#ffffff", anchor="middle", valign="middle")
    ly = ay0 + ah + 8
    for k, (col, lab) in enumerate(MASK_LEGEND):
        legend_item(s, ax0 + (k % 3) * 80, ly + (k // 3) * 9, col, lab, size=6)

    # B forest
    bx = 262
    s.label(bx, 0, "B")
    f = d["forest"]
    ITL, STL = "intratumoral_lymphocyte_density", "stromal_lymphocyte_density"
    sc = Log(0.5, 1.25, bx + 14, W - 10)
    s.text((bx + W) / 2, 8, f"Overall survival, breast carcinoma (n = {f[ITL]['n']})", size=6.5, anchor="middle")
    ys = {ITL: 44, STL: 84}
    s.line(sc(1), 20, sc(1), 104, stroke="#777", sw=0.5, dash="2,1.5")
    for feat, col, lab in ((ITL, BLUE, "Intratumoral lymphocyte density"), (STL, VERMILLION, "Stromal lymphocyte density")):
        r_ = f[feat]
        y = ys[feat]
        s.text(bx + 14, y - 11, lab, size=6.5, weight="bold", fill=col)
        s.text(W - 10, y - 11, f"HR {r_['hr']:.2f} [{r_['lo']:.2f}, {r_['hi']:.2f}], P_{{adj}} = {r_['p_adj']:.2g}",
               size=6, anchor="end", halo="#ffffff")
        s.line(sc(r_["lo"]), y, sc(r_["hi"]), y, stroke=col, sw=1.0)
        for e in (r_["lo"], r_["hi"]):
            s.line(sc(e), y - 2.5, sc(e), y + 2.5, stroke=col, sw=1.0)
        if feat == ITL:
            s.circle(sc(r_["hr"]), y, 2.8, fill=col, stroke=col)
        else:
            diamond(s, sc(r_["hr"]), y, 3.2, col, col)
    axis_bottom(s, sc, 106, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2], labels=["0.5", "0.6", "0.7", "0.8", "0.9", "1", "1.2"],
                title="Hazard ratio (95% CI), adjusted Cox model", title_gap=10)

    # C / D tiles
    y2 = 184
    tw = 74
    gapt = 4
    for grp, col, letter, title, x0, num in (
            ("tiles_intratumoral", BLUE, "C", "Intratumoral lymphocyte density", 6, "1"),
            ("tiles_stromal", VERMILLION, "D", "Stromal lymphocyte density", 6 + 3 * (tw + gapt) + 14, "2")):
        s.label(x0 - 6, y2, letter)
        s.text(x0 + 1.5 * tw + gapt, y2 + 3, title, size=7, weight="bold", fill=col, anchor="middle", valign="top")
        s.circle(x0 + 3 * tw + 2 * gapt - 4, y2 + 6, 4.2, fill=col, stroke="#ffffff", sw=0.6)
        s.text(x0 + 3 * tw + 2 * gapt - 4, y2 + 6, num, size=6, weight="bold", fill="#ffffff", anchor="middle", valign="middle")
        for k, t in enumerate(d[grp]):
            tx = x0 + k * (tw + gapt)
            ty = y2 + 16
            key = f"brca_{t['tileX']}_{t['tileY']}"
            s.image(tx, ty, tw, tw, key)
            s.image(tx, ty + tw + gapt, tw, tw, key + "_overlay")
            s.rect(tx, ty, tw, tw, stroke=col, sw=0.8)
            s.rect(tx, ty + tw + gapt, tw, tw, stroke=col, sw=0.8)
            s.text(tx + 2.5, ty + 2.5, f"#{t['rank']}", size=6, weight="bold", fill="#ffffff", valign="top", halo=col)
            s.text(tx + tw / 2, ty + 2 * tw + gapt + 3, f"Tile score {t['score']:,.0f}", size=6, anchor="middle",
                   valign="top", fill=INK2)
        if letter == "C":
            s.text(x0 - 1, y2 + 16 + tw / 2, "H&E", size=6.5, rotate=-90, anchor="middle", weight="bold")
            s.text(x0 - 1, y2 + 16 + tw * 1.5 + gapt, "Cell calls", size=6.5, rotate=-90, anchor="middle", weight="bold")
    ly = y2 + 16 + 2 * tw + gapt + 18
    s.text(6, ly, "Cell-call outline colors", size=6, weight="bold", valign="middle")
    for k, (lab, col) in enumerate(CELL_LEGEND):
        cx_, cy_ = 6 + (k % 7) * 69, ly + 10 + (k // 7) * 9
        s.rect(cx_ + 0.6, cy_ - 2.0, 4.0, 4.0, fill="none", stroke=col, sw=1.3)
        s.text(cx_ + 7.5, cy_, lab, size=6, valign="middle")
    return s



CLUSTER_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
                  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]


# ===========================================================================
# Supplementary Figure S1: measurement x pathway map, distributions
# ===========================================================================
def figureS1() -> SVG:
    d = load("figS1")
    s = SVG(W, 560)
    s.label(0, 0, "A")
    feats, paths = d["features"], d["pathways"]
    cw, rh = 8.6, 6.3
    mx, my = 82, 14
    M = [[d["matrix"][i][j] for i in range(len(feats))] for j in range(len(paths))]
    heatmap(s, mx, my, cw, rh, M, diverging, 0.3)
    for j, pth in enumerate(paths):
        s.text(mx - 2.5, my + (j + 0.5) * rh, hallmark(pth), size=6, anchor="end", valign="middle")
    for i, f in enumerate(feats):
        s.rect(mx + i * cw + 0.4, my + len(paths) * rh + 1, cw - 0.8, 3.2, fill=CATEGORY_COLORS[d["category_of"][f]])
        s.text(mx + (i + 0.5) * cw, my + len(paths) * rh + 6, d["labels"][f], size=6, anchor="end", valign="middle", rotate=-90)
    cbx = mx + len(feats) * cw + 8
    s.text(cbx - 2, my + 4, "Mean ρ", size=6.5, valign="top")
    colorbar_v(s, cbx, my + 14, 5, 80, diverging_cb(0.3), -0.3, 0.3, [-0.3, -0.15, 0, 0.15, 0.3])
    ly = my + 110
    for k, cat in enumerate(CATEGORY_COLORS):
        legend_item(s, cbx - 2, ly + k * 9, CATEGORY_COLORS[cat], cat, size=6)

    y2 = 450
    s.label(0, y2, "B")
    names = {"expression": "Gene expression", "pathway": "Hallmark pathways", "cnv": "Copy number"}
    pw = 128
    for k, t in enumerate(["expression", "pathway", "cnv"]):
        dd = d["dists"][t]
        x0 = 36 + k * (pw + 32)
        y0, y1 = y2 + 16, y2 + 80
        edges = dd["edges"]
        mx_ = max(a + b for a, b in zip(dd["sig"], dd["ns"]))
        sx = Lin(edges[0], edges[-1], x0, x0 + pw)
        tk = nice_ticks(0, mx_, 3)
        if tk[-1] < mx_:
            tk.append(tk[-1] + (tk[1] - tk[0]))
        sy = Lin(0, tk[-1], y1, y0)
        for i in range(len(edges) - 1):
            a, b = sx(edges[i]), sx(edges[i + 1])
            s.rect(a, sy(dd["ns"][i]), b - a - 0.2, y1 - sy(dd["ns"][i]), fill="#c8c8c8")
            s.rect(a, sy(dd["ns"][i] + dd["sig"][i]), b - a - 0.2, sy(dd["ns"][i]) - sy(dd["ns"][i] + dd["sig"][i]), fill=BLUE)
        axis_left(s, sy, x0, tk, y0=y1, y1=y0, title="Associations" if k == 0 else None)
        axis_bottom(s, sx, y1, [-0.6, -0.3, 0, 0.3, 0.6], title="Spearman ρ, pan-cancer adjusted", title_gap=9)
        s.text(x0 + pw / 2, y0 - 6, names[t], size=7, weight="bold", anchor="middle")
        s.text(x0 + pw, y0 + 2, f"{fmt_int(dd['n_sig'])}/{fmt_int(dd['n'])}", size=6, anchor="end", valign="top", fill=INK2)
        s.text(x0 + pw, y0 + 10, "FDR < 0.05", size=6, anchor="end", valign="top", fill=INK2)
    legend_item(s, 36, y2 + 108, BLUE, "FDR < 0.05", size=6)
    legend_item(s, 100, y2 + 108, "#c8c8c8", "Not significant", size=6)
    return s


# ===========================================================================
# Supplementary Figure S2: cluster molecular archetypes
# ===========================================================================
def figureS2() -> SVG:
    d = load("figS2")
    s = SVG(W, 372)
    cl = d["clusters"]
    sub_names = {"C1": "C1 wound healing", "C2": "C2 IFN-γ dominant", "C3": "C3 inflammatory",
                 "C4": "C4 lymphocyte depleted", "C6": "C6 TGF-β dominant"}
    s.label(0, 0, "A")
    cw, rh = 16, 13
    mx, my = 26, 70
    M = [d["log2or"][str(c)] for c in cl]
    vm = 4
    heatmap(s, mx, my, cw, rh, [[None if v is None else max(-vm, min(vm, v)) for v in r_] for r_ in M], diverging, vm)
    for i, c in enumerate(cl):
        s.text(mx - 3, my + (i + 0.5) * rh, f"C{c}", size=6, anchor="end", valign="middle")
        for j in range(len(d["subtypes"])):
            if d["or_sig"][str(c)][j]:
                s.circle(mx + (j + 0.5) * cw, my + (i + 0.5) * rh, 1.0, fill=INK)
    for j, st in enumerate(d["subtypes"]):
        s.text(mx + (j + 0.5) * cw, my - 3, sub_names[st], size=6, rotate=-60)
    s.text(mx + 2.5 * cw, my + len(cl) * rh + 10, "Immune subtype", size=6.5, anchor="middle", valign="top")
    colorbar_h(s, mx, my + len(cl) * rh + 34, 80, 5, diverging_cb(vm), -vm, vm, [-4, -2, 0, 2, 4],
               title="log₂ odds ratio")

    s.label(140, 0, "B")
    paths = d["pathways"]
    bx, by = 222, 10
    cw2, rh2 = 22, 6.3
    M2 = [[d["delta"][str(c)][i] for c in cl] for i in range(len(paths))]
    heatmap(s, bx, by, cw2, rh2, M2, diverging, 0.5)
    for i, pth in enumerate(paths):
        s.text(bx - 2.5, by + (i + 0.5) * rh2, hallmark(pth), size=6, anchor="end", valign="middle")
        for j, c in enumerate(cl):
            if d["delta_sig"][str(c)][i]:
                v = M2[i][j]
                s.circle(bx + (j + 0.5) * cw2, by + (i + 0.5) * rh2, 0.8, fill="#ffffff" if v and abs(v) > 0.3 else INK)
    for j, c in enumerate(cl):
        s.text(bx + (j + 0.5) * cw2, by + len(paths) * rh2 + 3, f"C{c}", size=6, anchor="middle", valign="top")
    s.text(bx + 5 * cw2, by + len(paths) * rh2 + 13, "Morphological cluster", size=6.5, anchor="middle", valign="top")
    cbx = bx + 10 * cw2 + 8
    s.text(cbx - 2, by + 2, "Cliff's δ", size=6.5, valign="top")
    colorbar_v(s, cbx, by + 12, 5, 70, diverging_cb(0.5), -0.5, 0.5, [-0.5, -0.25, 0, 0.25, 0.5])
    s.circle(cbx + 2.5, by + 96, 1.0, fill=INK)
    s.text(cbx + 6, by + 96, "FDR < 0.05", size=6, valign="middle")
    return s


# ===========================================================================
# Supplementary Figure S3: batch effects and power
# ===========================================================================
def figureS3() -> SVG:
    d = load("figS3")
    s = SVG(W, 282)
    s.label(0, 0, "A")
    rows = d["pvca"]
    x0, x1 = 34, 214
    y0 = 18
    rh = 11
    sx = Lin(0, 1, x0, x1)
    for i, r_ in enumerate(rows):
        yy = y0 + i * rh
        s.text(x0 - 3, yy + rh / 2, r_["ct"], size=6, anchor="end", valign="middle")
        s.rect(x0, yy + 2, sx(r_["batch"]) - x0, rh - 4, fill=VERMILLION)
        s.rect(sx(r_["batch"]), yy + 2, x1 - sx(r_["batch"]), rh - 4, fill="#d0d0d0")
        s.text(sx(r_["batch"]) + 2, yy + rh / 2, f"{r_['batch'] * 100:.0f}%", size=6, valign="middle")
    yb = y0 + len(rows) * rh
    axis_bottom(s, sx, yb + 1, [0, 0.25, 0.5, 0.75, 1], labels=["0", "25", "50", "75", "100"],
                title="Variance explained (%)", title_gap=9)
    legend_item(s, x0, yb + 32, VERMILLION, "Tissue source site", size=6)
    legend_item(s, x0 + 72, yb + 32, "#d0d0d0", "Residual", size=6)
    pan = d["pan"]
    s.text(x0, 8, f"Pan-cancer: source site {pan['batch'] * 100:.1f}%, cancer type {pan['bio'] * 100:.1f}%, residual "
                  f"{pan['resid'] * 100:.1f}%", size=6, fill=INK2)

    bx = 262
    s.label(bx, 0, "B")
    md = d["mdes"]
    cts = list(md.keys())
    gx0, gx1 = bx + 66, W - 10
    sx = Lin(1, 5.2, gx0, gx1)
    s.line(sx(1.5), y0 - 2, sx(1.5), y0 + len(cts) * rh, stroke="#777", sw=0.5, dash="2,1.5")
    s.text(sx(1.5) + 2, y0 - 4, "HR 1.5", size=6, fill=INK2)
    for i, ct in enumerate(cts):
        yy = y0 + i * rh + rh / 2
        m = md[ct]
        s.text(gx0 - 3, yy, f"{ct} (n = {fmt_int(m['n'])})", size=6, anchor="end", valign="middle")
        if not m["q"]:
            continue
        q = m["q"]
        s.line(sx(q[0]), yy, sx(min(q[4], 5.2)), yy, stroke=INK, sw=0.5)
        s.rect(sx(q[1]), yy - 3, max(sx(q[3]) - sx(q[1]), 0.8), 6, fill=CANCER_COLORS[ct], stroke=INK, sw=0.4)
        s.line(sx(q[2]), yy - 3, sx(q[2]), yy + 3, stroke=INK, sw=1.0)
    axis_bottom(s, sx, y0 + len(cts) * rh + 1, [1, 2, 3, 4, 5], title="Minimum detectable HR at 80% power", title_gap=9)
    return s


# ===========================================================================
# Supplementary Figure S4: cluster transfer
# ===========================================================================
def figureS4() -> SVG:
    d = load("figS4")
    s = SVG(W, 246)
    s.label(0, 0, "A")
    pw, ph = 118, 92

    def umap(x0, y0, D, mode, title, gray_unassigned=False):
        xs, ys = np.array(D["x"]), np.array(D["y"])
        sx = Lin(xs.min() - 0.3, xs.max() + 0.3, x0, x0 + pw)
        sy = Lin(ys.min() - 0.3, ys.max() + 0.3, y0 + ph, y0)
        pts = []
        for i in range(len(xs)):
            if mode == "ct":
                col = CANCER_COLORS.get(D["ct"][i], "#999")
            else:
                c = D["cl"][i]
                col = "#d0d0d0" if c is None or c < 0 else CLUSTER_COLORS[int(c)]
            pts.append(f'<circle cx="{sx(xs[i]):.1f}" cy="{sy(ys[i]):.1f}" r="{0.6 if len(xs) > 2000 else 1.0}" fill="{col}"/>')
        s.add('<g fill-opacity="0.85">' + "".join(pts) + "</g>")
        s.text(x0 + pw / 2, y0 - 4, title, size=6.5, weight="bold", anchor="middle")
        s.text(x0 + pw, y0 + ph, f"n = {fmt_int(len(xs))}", size=6, anchor="end", fill=INK2)

    cp = dict(d["cptac"])
    cp_cl = [c if i < 0 else c for i, c in enumerate(cp["cl"])]
    umap(4, 14, d["tcga"], "ct", "TCGA, cancer type")
    umap(4 + pw + 10, 14, cp, "ct", "CPTAC, cancer type")
    umap(4, 14 + ph + 22, d["tcga"], "cl", "TCGA, cluster")
    umap(4 + pw + 10, 14 + ph + 22, cp, "cl", "CPTAC, transferred cluster")
    ly = 14 + 2 * ph + 34
    for k in range(10):
        legend_item(s, 4 + (k % 6) * 40, ly + (k // 6) * 9, CLUSTER_COLORS[k], f"C{k}", kind="dot", size=6)
    legend_item(s, 4 + 4 * 40, ly + 9, "#d0d0d0", "Not transferred", kind="dot", size=6)

    bx = 268
    s.label(bx, 0, "B")
    cmp_ = d["comparison"]
    x0, y0, size = bx + 30, 14, 140
    sx = Lin(-0.85, 0.85, x0, x0 + size)
    sy = Lin(-0.85, 0.85, y0 + size, y0)
    s.line(sx(-0.85), sy(-0.85), sx(0.85), sy(0.85), stroke="#777", sw=0.5, dash="2,1.5")
    s.line(sx(0), y0, sx(0), y0 + size, stroke=GRID, sw=0.4)
    s.line(x0, sy(0), x0 + size, sy(0), stroke=GRID, sw=0.4)
    for a, b, c in zip(cmp_["x"], cmp_["y"], cmp_["cl"]):
        if a is None or b is None:
            continue
        s.circle(sx(a), sy(b), 1.3, fill=CLUSTER_COLORS[c], opacity=0.8)
    axis_left(s, sy, x0, [-0.8, -0.4, 0, 0.4, 0.8], title="CPTAC Cliff's δ")
    axis_bottom(s, sx, y0 + size, [-0.8, -0.4, 0, 0.4, 0.8], title="TCGA Cliff's δ", title_gap=9)
    s.rect(x0, y0, size, size, stroke=AXIS, sw=0.4)
    stat_box(s, x0 + 3, y0 + 3, [f"ρ = {cmp_['rho']:.2f}, P = {cmp_['p']:.1g}", f"n = {cmp_['n']} pairs"])
    tx = x0 + size + 6
    s.text(tx, y0 + 2, "Per cluster ρ", size=6, weight="bold", valign="top")
    for k, r_ in enumerate(d["per_cluster"]):
        yy = y0 + 14 + k * 9
        s.circle(tx + 2.5, yy, 2.2, fill=CLUSTER_COLORS[r_["cl"]])
        star = "*" if r_["p"] < 0.05 else ""
        s.text(tx + 7, yy, f"C{r_['cl']}  {r_['rho']:+.2f}{star}".replace("-", "−"), size=6, valign="middle")
    s.text(tx, y0 + 14 + 9 * len(d["per_cluster"]) + 2, "* P < 0.05", size=6, valign="top", fill=INK2)
    return s


# ===========================================================================
# Graphical abstract: 1,200 x 1,200 px at 300 dpi (4 x 4 in)
# ===========================================================================
def graphical_abstract() -> SVG:
    c = load("cohort")
    s = SVG(288, 288)
    s.text(144, 10, "HistoAtlas", size=16, weight="bold", anchor="middle", valign="top")
    cols = [48, 144, 240]
    # top row
    s.image(cols[0] - 40, 42, 80, 50, "luad_thumb", preserve="xMidYMid meet")
    counts = [3, 8, 7, 11, 5, 4]
    for k, col in enumerate(CATEGORY_COLORS.values()):
        s.rect(cols[1] - 29, 44 + k * 8.2, counts[k] * 5.2, 6.2, fill=col)
    for k, (hr, w) in enumerate([(0.72, 0.13), (0.93, 0.18), (1.25, 0.22)]):
        y = 50 + k * 15
        x = cols[2] - 12 + (hr - 1) * 50
        s.line(x - w * 50, y, x + w * 50, y, stroke=BLUE, sw=1.4)
        s.circle(x, y, 2.8, fill=BLUE)
    s.line(cols[2] - 12, 40, cols[2] - 12, 90, stroke="#777", sw=0.8, dash="2,2")
    for x in (cols[0] + 46, cols[1] + 46):
        s.path(f"M{x - 10},67 L{x + 6},67", stroke="#9a9a9a", sw=1.6)
        s.path(f"M{x + 2},62 L{x + 8},67 L{x + 2},72", stroke="#9a9a9a", sw=1.6)
    for x, a, b in ((cols[0], "Routine H&E", f"{c['tcga_slides']:,} slides"), (cols[1], "38 named", "measurements"),
                    (cols[2], "Associations", "with uncertainty")):
        s.text(x, 100, a, size=12, anchor="middle", valign="top")
        s.text(x, 114, b, size=12, anchor="middle", valign="top", fill=INK2 if x == cols[0] else INK)
    s.line(14, 140, 274, 140, stroke=GRID, sw=0.8)
    # bottom row
    s.circle(cols[0] - 9, 176, 16, fill="none", stroke=BLUE, sw=2)
    s.circle(cols[0] + 9, 176, 16, fill="none", stroke=ORANGE, sw=2)
    s.text(cols[1] - 26, 168, "RNA", size=12, anchor="middle", valign="middle")
    s.path(f"M{cols[1] - 10},168 L{cols[1] + 4},168", stroke="#9a9a9a", sw=1.6)
    s.path(f"M{cols[1]},164 L{cols[1] + 5},168 L{cols[1]},172", stroke="#9a9a9a", sw=1.6)
    s.text(cols[1] + 26, 168, "Protein", size=12, anchor="middle", valign="middle")
    s.rect(cols[2] - 20, 156, 40, 40, fill="#ffffff")
    s.image(cols[2] - 20, 156, 40, 40, "luad_ov")
    s.rect(cols[2] - 20, 156, 40, 40, stroke="#555", sw=0.8)
    for x, a, b in ((cols[0], "Replicated in", "new cohort"), (cols[1], "Extends to", "protein"),
                    (cols[2], "Traceable", "to cells")):
        s.text(x, 210, a, size=12, anchor="middle", valign="top")
        s.text(x, 224, b, size=12, anchor="middle", valign="top")
    s.rect(14, 250, 260, 28, fill="#eef4fa", rx=4)
    s.text(144, 264, "Open atlas and API", size=12, weight="bold", anchor="middle", valign="middle")
    return s


def diverging_cb(vmax):
    return lambda v: diverging(v, vmax)


DESIGN = ART / "design"
# artboard file, title, canvas page
ARTBOARDS = {
    "Figure1": ("Main.dc.html", "Figure 1", "main"), "Figure2": ("Figure2.dc.html", "Figure 2", "main"),
    "Figure3": ("Figure3.dc.html", "Figure 3", "main"), "Figure4": ("Figure4.dc.html", "Figure 4", "main"),
    "Figure5": ("Figure5.dc.html", "Figure 5", "main"), "Figure6": ("Figure6.dc.html", "Figure 6", "main"),
    "FigureS1": ("FigureS1.dc.html", "Figure S1", "supp"), "FigureS2": ("FigureS2.dc.html", "Figure S2", "supp"),
    "FigureS3": ("FigureS3.dc.html", "Figure S3", "supp"), "FigureS4": ("FigureS4.dc.html", "Figure S4", "supp"),
    "GraphicalAbstract": ("GraphicalAbstract.dc.html", "Graphical abstract", "ga"),
}
PX = 4 / 3  # CSS px per pt


def write_artboard(name: str, s: SVG, assets: dict[str, str]) -> dict:
    """Write the figure as a Claude Design artboard (.dc.html) with uploaded image URLs."""
    blobs = json.load(open(DESIGN / "blob_urls.json"))
    hrefs = {k: blobs[v] for k, v in assets.items() if v in blobs}
    fname, title, page = ARTBOARDS[name]
    w, h = round(s.w * PX, 2), round(s.h * PX, 2)
    svg = s.svg(hrefs, scale_mm=False, px_scale=PX).replace('role="img"', f'role="img" aria-label="{title}"')
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; background: #ffffff; font-family: Arial, Helvetica, sans-serif; color: #1a1a1a">
{svg}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
"""
    (DESIGN / "project").mkdir(parents=True, exist_ok=True)
    (DESIGN / "project" / fname).write_text(doc)
    return {"file": fname, "title": title, "page": page, "w": w, "h": h}


def write_canvas_index(boards: list[dict]):
    import datetime
    x = {"main": 0, "supp": 0, "ga": 0}
    entries, order = {}, []
    for b in boards:
        entries[b["file"]] = {"x": x[b["page"]], "y": 0, "w": b["w"], "h": b["h"], "title": b["title"],
                              "page": b["page"]}
        x[b["page"]] += b["w"] + 80
        order.append(b["file"])
    idx = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
           "title": "HistoAtlas – Patterns figures", "launch": {"view": "canvas", "page": "main"},
           "pages": [{"id": "main", "name": "Main figures"}, {"id": "supp", "name": "Supplementary figures"},
                     {"id": "ga", "name": "Graphical abstract"}],
           "boards": entries, "order": order, "notes": {}, "designSystems": []}
    json.dump(idx, open(DESIGN / "project/canvas.json", "w"), indent=1, ensure_ascii=False)


FIGURES = {"Figure1": figure1, "Figure2": figure2, "Figure3": figure3, "Figure4": figure4,
           "Figure5": figure5, "Figure6": figure6, "FigureS1": figureS2, "FigureS2": figureS1,
           "FigureS3": figureS3, "FigureS4": figureS4, "GraphicalAbstract": graphical_abstract}


def main(which=None):
    assets = prepare_assets()
    json.dump(assets, open(ASSETS / "manifest.json", "w"), indent=1)
    boards = []
    for name, fn in FIGURES.items():
        s = fn()
        if (DESIGN / "blob_urls.json").exists():
            boards.append(write_artboard(name, s, assets))
        if which and name not in which:
            continue
        rel = {k: f"../assets/{v}" for k, v in assets.items()}
        (SVG_OUT / f"{name}.svg").write_text(s.svg(rel))
        json.dump({"w": s.w, "h": s.h}, open(SVG_OUT / f"{name}.size.json", "w"))
        print(f"{name}: {s.w / MM:.0f} x {s.h / MM:.0f} mm")
    if boards:
        write_canvas_index(boards)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
