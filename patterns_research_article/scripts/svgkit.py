"""Minimal SVG drawing kit for print-size journal figures.

Units are PostScript points (1 pt = 1/72 in). A Cell Press full-width figure is
174 mm = 493.2 pt. Text is set in Arial (falling back to the metrically
identical Liberation Sans). Nothing here computes statistics.
"""

from __future__ import annotations

import html
import math
import re
from pathlib import Path

import numpy as np

MM = 72 / 25.4  # pt per mm
FULL_W = 174 * MM  # 493.2 pt
ONEHALF_W = 114 * MM
SINGLE_W = 85 * MM

FONT_FAMILY = "Arial, Helvetica, 'Liberation Sans', sans-serif"
INK = "#1a1a1a"
INK2 = "#4d4d4d"
MUTED = "#7a7a7a"
GRID = "#d9d9d9"
AXIS = "#333333"

# Okabe-Ito based categorical colours (colour-vision-deficiency safe)
BLUE = "#0072B2"
ORANGE = "#E69F00"
VERMILLION = "#D55E00"
GREEN = "#009E73"
SKY = "#56B4E9"
PURPLE = "#CC79A7"
YELLOW = "#F0E442"

CATEGORY_COLORS = {
    "Composition": "#0072B2",
    "Density": "#E69F00",
    "Morphology": "#CC79A7",
    "Spatial": "#56B4E9",
    "Heterogeneity": "#009E73",
    "Ratios": "#D55E00",
}

# The HistoAtlas web palette for cancer types, kept for consistency with the atlas.
CANCER_COLORS = {
    "ACC": "#E69F00", "BLCA": "#56B4E9", "BRCA": "#009E73", "CESC": "#F0E442",
    "CHOL": "#0072B2", "COAD": "#D55E00", "ESCA": "#CC79A7", "HNSC": "#1F77B4",
    "LIHC": "#FF7F0E", "LUAD": "#2CA02C", "LUSC": "#D62728", "MESO": "#9467BD",
    "OV": "#8C564B", "PAAD": "#E377C2", "PRAD": "#7F7F7F", "READ": "#BCBD22",
    "STAD": "#17BECF", "THCA": "#AEC7E8", "THYM": "#FFBB78", "UCEC": "#98DF8A",
    "UCS": "#FF9896", "HNSCC": "#1F77B4",
}
CPTAC_COLORS = {"BRCA": "#009E73", "HNSCC": "#0072B2", "LUAD": "#E69F00", "PAAD": "#CC79A7", "UCEC": "#56B4E9"}

# ---------------------------------------------------------------------------
# Text metrics
# ---------------------------------------------------------------------------
_FONT_CANDIDATES = {
    "normal": ["/System/Library/Fonts/Supplemental/Arial.ttf",
               "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
               "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
               "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"],
    "bold": ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
             "/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf",
             "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
             "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"],
}
_fonts: dict = {}


def _font(weight: str):
    from PIL import ImageFont
    if weight not in _fonts:
        for p in _FONT_CANDIDATES[weight]:
            if Path(p).exists():
                _fonts[weight] = ImageFont.truetype(p, 100)
                break
        else:
            _fonts[weight] = None
    return _fonts[weight]


def text_width(s: str, size: float = 7, weight: str = "normal") -> float:
    s = re.sub(r"[*{}^_]", "", s)
    f = _font("bold" if weight == "bold" else "normal")
    if f is None:
        return len(s) * size * 0.52
    return f.getlength(s) * size / 100


# ---------------------------------------------------------------------------
# Colour maps
# ---------------------------------------------------------------------------
def _hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(int(round(max(0, min(1, c)) * 255)) for c in rgb[:3])


_RDBU = ["#053061", "#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#f7f7f7",
         "#fddbc7", "#f4a582", "#d6604d", "#b2182b", "#67001f"]
_BLUES = ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6",
          "#2171b5", "#08519c", "#08306b"]


def _interp(stops, t):
    t = min(1.0, max(0.0, t))
    pos = t * (len(stops) - 1)
    i = min(int(pos), len(stops) - 2)
    f = pos - i
    a = np.array([int(stops[i][k:k + 2], 16) for k in (1, 3, 5)]) / 255
    b = np.array([int(stops[i + 1][k:k + 2], 16) for k in (1, 3, 5)]) / 255
    return _hex(a + (b - a) * f)


def diverging(v, vmax=1.0):
    """RdBu_r: blue = negative, red = positive, light grey midpoint."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "#ffffff"
    return _interp(_RDBU, (v / vmax + 1) / 2)


def sequential(t):
    return _interp(_BLUES, t)


# ---------------------------------------------------------------------------
# Scales and ticks
# ---------------------------------------------------------------------------
class Lin:
    def __init__(self, d0, d1, r0, r1):
        self.d0, self.d1, self.r0, self.r1 = d0, d1, r0, r1

    def __call__(self, v):
        return self.r0 + (v - self.d0) / (self.d1 - self.d0) * (self.r1 - self.r0)


class Log:
    def __init__(self, d0, d1, r0, r1):
        self.l0, self.l1, self.r0, self.r1 = math.log(d0), math.log(d1), r0, r1

    def __call__(self, v):
        return self.r0 + (math.log(v) - self.l0) / (self.l1 - self.l0) * (self.r1 - self.r0)


def nice_ticks(lo, hi, n=5):
    span = hi - lo
    raw = span / max(n, 1)
    mag = 10 ** math.floor(math.log10(raw))
    step = min([1, 2, 2.5, 5, 10], key=lambda m: abs(m * mag - raw)) * mag
    start = math.ceil(lo / step - 1e-9) * step
    out = []
    v = start
    while v <= hi + step * 1e-6:
        out.append(round(v, 10))
        v += step
    return out


def fmt_num(v, nd=None):
    if nd is None:
        if abs(v - round(v)) < 1e-9:
            return f"{int(round(v))}".replace("-", "−")
        nd = 2 if abs(v) < 1 else 1
    s = f"{v:.{nd}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s.replace("-", "−")


def sci(p, nd=1):
    """Format a P value as rich text: 1.8 x 10^-68."""
    if p is None:
        return "n/a"
    if p >= 1e-3:
        return f"{p:.2g}" if p < 0.01 else f"{p:.2f}".rstrip("0").rstrip(".")
    e = int(math.floor(math.log10(p)))
    m = p / 10 ** e
    return f"{m:.{nd}f} × 10^{{−{abs(e)}}}"


# ---------------------------------------------------------------------------
# SVG canvas
# ---------------------------------------------------------------------------
_RICH = re.compile(r"(\*[^*]+\*|\^\{[^}]*\}|_\{[^}]*\})")


class SVG:
    def __init__(self, w: float, h: float):
        self.w, self.h = w, h
        self.els: list[str] = []
        self.defs: list[str] = []
        self._clip = 0

    # primitives ---------------------------------------------------------
    def add(self, s: str):
        self.els.append(s)

    def rect(self, x, y, w, h, fill="none", stroke=None, sw=0.5, rx=0, opacity=None, extra=""):
        a = f'<rect x="{x:.2f}" y="{y:.2f}" width="{max(w, 0):.2f}" height="{max(h, 0):.2f}" fill="{fill}"'
        if stroke:
            a += f' stroke="{stroke}" stroke-width="{sw}"'
        if rx:
            a += f' rx="{rx}"'
        if opacity is not None:
            a += f' fill-opacity="{opacity}"'
        self.add(a + f"{extra}/>")

    def line(self, x1, y1, x2, y2, stroke=AXIS, sw=0.5, dash=None, cap=None, opacity=None):
        a = f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{sw}"'
        if dash:
            a += f' stroke-dasharray="{dash}"'
        if cap:
            a += f' stroke-linecap="{cap}"'
        if opacity is not None:
            a += f' stroke-opacity="{opacity}"'
        self.add(a + "/>")

    def path(self, d, stroke="none", fill="none", sw=0.5, opacity=None, dash=None, join=None, fill_opacity=None):
        a = f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
        if opacity is not None:
            a += f' stroke-opacity="{opacity}"'
        if fill_opacity is not None:
            a += f' fill-opacity="{fill_opacity}"'
        if dash:
            a += f' stroke-dasharray="{dash}"'
        if join:
            a += f' stroke-linejoin="{join}"'
        self.add(a + "/>")

    def polyline(self, pts, stroke, sw=0.75, fill="none", dash=None, opacity=None):
        d = "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        self.path(d, stroke=stroke, fill=fill, sw=sw, dash=dash, opacity=opacity, join="round")

    def circle(self, cx, cy, r, fill="none", stroke=None, sw=0.5, opacity=None):
        a = f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}"'
        if stroke:
            a += f' stroke="{stroke}" stroke-width="{sw}"'
        if opacity is not None:
            a += f' fill-opacity="{opacity}"'
        self.add(a + "/>")

    def image(self, x, y, w, h, key, preserve="xMidYMid slice", clip_rx=0):
        self.add(f'<image x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
                 f'preserveAspectRatio="{preserve}" href="{{{{IMG:{key}}}}}"/>')

    def text(self, x, y, s, size=7, anchor="start", weight="normal", fill=INK, rotate=None,
             italic=False, valign="baseline", opacity=None, halo=None):
        """Rich text: *italic*, ^{sup}, _{sub}."""
        dy = {"baseline": 0, "middle": 0.35 * size, "top": 0.75 * size}[valign]
        attrs = (f'x="{x:.2f}" y="{y + dy:.2f}" font-size="{size}" fill="{fill}" '
                 f'text-anchor="{anchor}"')
        if weight != "normal":
            attrs += f' font-weight="{weight}"'
        if italic:
            attrs += ' font-style="italic"'
        if opacity is not None:
            attrs += f' fill-opacity="{opacity}"'
        if rotate is not None:
            attrs += f' transform="rotate({rotate} {x:.2f} {y:.2f})"'
        if halo:
            attrs += f' stroke="{halo}" stroke-width="2" stroke-linejoin="round" paint-order="stroke"'
        self.add(f"<text {attrs}>{self._rich(s, size)}</text>")

    def _rich(self, s, size):
        parts = _RICH.split(s)
        out = []
        shift = 0.0
        for p in parts:
            if not p:
                continue
            if p.startswith("*") and p.endswith("*") and len(p) > 2:
                out.append(f'<tspan font-style="italic">{html.escape(p[1:-1])}</tspan>')
            elif p.startswith("^{"):
                d = -0.38 * size
                out.append(f'<tspan dy="{d:.2f}" font-size="{size * 0.72:.2f}">{html.escape(p[2:-1])}</tspan>'
                           f'<tspan dy="{-d:.2f}">​</tspan>')
            elif p.startswith("_{"):
                d = 0.22 * size
                out.append(f'<tspan dy="{d:.2f}" font-size="{size * 0.72:.2f}">{html.escape(p[2:-1])}</tspan>'
                           f'<tspan dy="{-d:.2f}">​</tspan>')
            else:
                out.append(html.escape(p))
        return "".join(out)

    def label(self, x, y, letter):
        """Cell Press panel letter: capital, bold."""
        self.text(x, y, letter, size=9, weight="bold", valign="top")

    def group(self, transform=None):
        self.add(f'<g transform="{transform}">' if transform else "<g>")

    def end(self):
        self.add("</g>")

    def clip_start(self, x, y, w, h):
        self._clip += 1
        cid = f"c{self._clip}"
        self.defs.append(f'<clipPath id="{cid}"><rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}"/></clipPath>')
        self.add(f'<g clip-path="url(#{cid})">')

    # output -------------------------------------------------------------
    def svg(self, images: dict[str, str] | None = None, scale_mm=True, px_scale=None) -> str:
        if px_scale:
            size = f'width="{self.w * px_scale:.1f}" height="{self.h * px_scale:.1f}"'
        elif scale_mm:
            size = f'width="{self.w / MM:.2f}mm" height="{self.h / MM:.2f}mm"'
        else:
            size = ""
        body = "\n".join(self.els)
        if images is not None:
            body = re.sub(r"\{\{IMG:([^}]+)\}\}", lambda m: images[m.group(1)], body)
        defs = f"<defs>{''.join(self.defs)}</defs>" if self.defs else ""
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w:.2f} {self.h:.2f}" {size} '
                f'font-family="{FONT_FAMILY}" role="img">{defs}'
                f'<rect width="{self.w:.2f}" height="{self.h:.2f}" fill="#ffffff"/>\n{body}\n</svg>')


# ---------------------------------------------------------------------------
# Axis helpers
# ---------------------------------------------------------------------------
def axis_bottom(s: SVG, scale, y, ticks, x0=None, x1=None, labels=None, title=None, size=6,
                tick_len=2.5, title_gap=13, color=AXIS):
    xs = [scale(t) for t in ticks]
    a = x0 if x0 is not None else min(xs)
    b = x1 if x1 is not None else max(xs)
    s.line(a, y, b, y, stroke=color, sw=0.5)
    for t, x in zip(ticks, xs):
        s.line(x, y, x, y + tick_len, stroke=color, sw=0.5)
        s.text(x, y + tick_len + 1.2, labels[ticks.index(t)] if labels else fmt_num(t), size=size,
               anchor="middle", valign="top", fill=INK)
    if title:
        s.text((a + b) / 2, y + title_gap + size, title, size=7, anchor="middle")


def axis_left(s: SVG, scale, x, ticks, y0=None, y1=None, labels=None, title=None, size=6,
              tick_len=2.5, title_gap=None, color=AXIS):
    ys = [scale(t) for t in ticks]
    a = y0 if y0 is not None else min(ys)
    b = y1 if y1 is not None else max(ys)
    s.line(x, a, x, b, stroke=color, sw=0.5)
    wmax = 0
    for i, (t, y) in enumerate(zip(ticks, ys)):
        lab = labels[i] if labels else fmt_num(t)
        wmax = max(wmax, text_width(lab, size))
        s.line(x - tick_len, y, x, y, stroke=color, sw=0.5)
        s.text(x - tick_len - 1.5, y, lab, size=size, anchor="end", valign="middle")
    if title:
        g = title_gap if title_gap is not None else wmax + tick_len + 6
        s.text(x - g, (a + b) / 2, title, size=7, anchor="middle", rotate=-90)


def colorbar_v(s: SVG, x, y, w, h, cmap, vmin, vmax, ticks, title=None, n=64, size=6, labels=None):
    for i in range(n):
        t0 = i / n
        v = vmin + (1 - t0 - 1 / (2 * n)) * (vmax - vmin)
        s.rect(x, y + t0 * h, w, h / n + 0.3, fill=cmap(v))
    s.rect(x, y, w, h, stroke=AXIS, sw=0.4)
    sc = Lin(vmin, vmax, y + h, y)
    for i, t in enumerate(ticks):
        yy = sc(t)
        s.line(x + w, yy, x + w + 2, yy, sw=0.4)
        s.text(x + w + 3, yy, labels[i] if labels else fmt_num(t), size=size, valign="middle")
    if title:
        s.text(x + w + 4 + max(text_width(labels[i] if labels else fmt_num(t), size) for i, t in enumerate(ticks)) + 5,
               y + h / 2, title, size=6.5, anchor="middle", rotate=-90)


def colorbar_h(s: SVG, x, y, w, h, cmap, vmin, vmax, ticks, title=None, n=64, size=6, labels=None):
    for i in range(n):
        v = vmin + (i + 0.5) / n * (vmax - vmin)
        s.rect(x + i / n * w, y, w / n + 0.3, h, fill=cmap(v))
    s.rect(x, y, w, h, stroke=AXIS, sw=0.4)
    sc = Lin(vmin, vmax, x, x + w)
    for i, t in enumerate(ticks):
        xx = sc(t)
        s.line(xx, y + h, xx, y + h + 2, sw=0.4)
        s.text(xx, y + h + 2.5, labels[i] if labels else fmt_num(t), size=size, anchor="middle", valign="top")
    if title:
        s.text(x + w / 2, y - 2.5, title, size=6.5, anchor="middle")


def legend_item(s: SVG, x, y, color, label, kind="square", size=6.5, stroke=None, filled=True):
    if kind == "square":
        s.rect(x, y - 2.6, 5.2, 5.2, fill=color, stroke=stroke, sw=0.4)
    elif kind == "dot":
        s.circle(x + 2.6, y, 2.4, fill=color if filled else "#ffffff", stroke=stroke or color, sw=0.6)
    elif kind == "line":
        s.line(x, y, x + 9, y, stroke=color, sw=1.2)
        s.text(x + 11, y, label, size=size, valign="middle")
        return x + 11 + text_width(label, size)
    elif kind == "diamond":
        d = 2.8
        s.path(f"M{x + 2.6},{y - d} L{x + 2.6 + d},{y} L{x + 2.6},{y + d} L{x + 2.6 - d},{y} Z",
               fill=color if filled else "#ffffff", stroke=color, sw=0.6)
    s.text(x + 7.5, y, label, size=size, valign="middle")
    return x + 7.5 + text_width(label, size)


def diamond(s: SVG, cx, cy, d, fill, stroke, sw=0.6):
    s.path(f"M{cx:.2f},{cy - d:.2f} L{cx + d:.2f},{cy:.2f} L{cx:.2f},{cy + d:.2f} L{cx - d:.2f},{cy:.2f} Z",
           fill=fill, stroke=stroke, sw=sw)


def triangle(s: SVG, cx, cy, d, fill, stroke, sw=0.6):
    s.path(f"M{cx:.2f},{cy - d:.2f} L{cx + d:.2f},{cy + d * 0.8:.2f} L{cx - d:.2f},{cy + d * 0.8:.2f} Z",
           fill=fill, stroke=stroke, sw=sw)
