#!/usr/bin/env python
"""Export figures/svg/*.svg to submission files with headless Chromium.

    python patterns_research_article/scripts/export_figures.py [--preview] [Figure1 ...]

  figures/<Figure>.pdf   vector PDF at exact print size, fonts embedded
  figures/<Figure>.tif   600 dpi RGB TIFF, LZW-compressed (Cell Press production format)
  --preview              PNG at 200 dpi in figures/preview/ only
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ART = Path(__file__).resolve().parents[1]
SVG_DIR = ART / "figures/svg"
OUT = ART / "figures"
PREV = OUT / "preview"
MM = 72 / 25.4


def page_html(svg_text: str) -> str:
    return ("<!doctype html><html><head><meta charset='utf-8'><style>"
            "@page{margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block}"
            "</style></head><body>" + svg_text + "</body></html>")


def main(args):
    preview = "--preview" in args
    names = [a for a in args if not a.startswith("--")]
    svgs = sorted(p for p in SVG_DIR.glob("*.svg") if not p.name.endswith(".raw.svg"))
    if names:
        svgs = [p for p in svgs if p.stem in names]
    PREV.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for p in svgs:
            size = json.load(open(SVG_DIR / f"{p.stem}.size.json"))
            w_mm, h_mm = size["w"] / MM, size["h"] / MM
            html_path = SVG_DIR / f".{p.stem}.html"
            html_path.write_text(page_html(p.read_text()))
            # Cell Press: figures 600 dpi here (combination halftone + line art);
            # graphical abstract exactly 1,200 x 1,200 px at 300 dpi
            dpi = 200 if preview else (300 if p.stem == "GraphicalAbstract" else 600)
            scale = dpi / 96
            vw, vh = int(round(w_mm / 25.4 * 96)), int(round(h_mm / 25.4 * 96))
            page = browser.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=scale)
            page.goto(html_path.as_uri())
            page.wait_for_load_state("networkidle")
            if preview:
                page.screenshot(path=str(PREV / f"{p.stem}.png"), full_page=False)
            else:
                page.pdf(path=str(OUT / f"{p.stem}.pdf"), width=f"{w_mm:.2f}mm", height=f"{h_mm:.2f}mm",
                         print_background=True, page_ranges="1")
                png = PREV / f".{p.stem}_600.png"
                page.screenshot(path=str(png), full_page=False)
                from PIL import Image
                im = Image.open(png).convert("RGB")
                im.save(OUT / f"{p.stem}.tif", compression="tiff_lzw", dpi=(dpi, dpi))
                png.unlink()
            page.close()
            html_path.unlink()
            print("exported", p.stem)
        browser.close()


if __name__ == "__main__":
    main(sys.argv[1:])
