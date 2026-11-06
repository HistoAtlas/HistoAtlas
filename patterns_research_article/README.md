# HistoAtlas: Patterns (Cell Press) Research Article submission

Branch `submission/patterns-research-article`. This folder is the complete
submission package for *Patterns*, built from the arXiv preprint
(arXiv:2603.16587, `paper_workspace/arxiv_v1`) and the v2 revision
(`paper_workspace/`). It does not touch either source, or the August draft in
`patterns_submission/`.

## What is here

| Path | What it is |
|---|---|
| `main.tex`, `sections/`, `references.bib` | Manuscript (elsarticle review mode: double spaced, line numbers, numbered references) |
| `main.pdf` | Compiled manuscript, with figure legends and the figures at the end |
| `supplement/supplement.tex`, `supplement/supplement.pdf` | Document S1: Figures S1–S4, Tables S1–S13 |
| `figures/Figure1–6.pdf`, `FigureS1–S4.pdf`, `GraphicalAbstract.pdf` | Vector figures at print size (174 mm wide), fonts embedded, each under 3 MB |
| `figures/*.tif` | 600 dpi LZW TIFFs for production; the graphical abstract is 1,200 × 1,200 px at 300 dpi (git-ignored, regenerate below) |
| `figures/svg/` | The vector source of every figure |
| `figures/assets/` | Raster images used in figures: unaltered H&E tiles and cell-call overlays, recolored compartment label maps, atlas screenshot |
| `figure_data/*.json` | Every value plotted and every statistic quoted in a legend, exported from the frozen pipeline runs |
| `design/project/` | The same figures as Claude Design artboards (the "HistoAtlas – Patterns figures" canvas) |
| `scripts/` | `export_figure_data.py`, `build_figures.py`, `svgkit.py`, `export_figures.py`, `check_submission.py`, `build_pdf.sh` |

## Rebuild everything

From the repository root:

```bash
uv run python patterns_research_article/scripts/export_figure_data.py   # pipeline outputs -> figure_data/*.json
uv run python patterns_research_article/scripts/build_figures.py        # JSON -> figures/svg + design/project
uv run python patterns_research_article/scripts/export_figures.py       # SVG -> PDF + TIFF (needs playwright + chromium)
patterns_research_article/scripts/build_pdf.sh                           # LaTeX -> main.pdf, supplement.pdf
uv run python patterns_research_article/scripts/check_submission.py     # Patterns compliance checks
```

The TCGA run (`data/runs/2026-03-09_15-53`) is addressed explicitly because
`data/latest` now points at the CPTAC run.

**Fonts.** Cell Press asks for Arial. The PDFs here were exported in a Linux
environment, so they embed Liberation Sans, which has the same metrics as Arial
(identical layout, slightly different letter shapes). For production files,
re-run `export_figures.py` on a Mac, which picks up Arial automatically, or
export the artboards from the Claude Design canvas on the Mac.

## Patterns requirements checked (`check_submission.py`: 0 failures)

- Title 134 characters (limit 150). Summary 132 words, one paragraph, no citations (limit 150).
- Four highlights, 71–76 characters each (limit 85). The bigger picture: 223 words (limit 300).
- Section order: Introduction, Results, Discussion, Methods, Resource availability (lead contact, materials, data and code), Acknowledgments, Author contributions, Declaration of interests, Declaration of generative AI and AI-assisted technologies in the manuscript preparation process, Supplemental information.
- Figures cited in order (1–6, S1–S4); every figure 174 mm wide, Arial 6–8 pt, RGB, capital panel letters, red and green never paired as the contrast, PDF under 3 MB, TIFF under 20 MB.
- Graphical abstract: square, 1,200 × 1,200 px at 300 dpi, 12–16 pt text, drawn as vectors (no generative image model).
- **Word count (warning):** Introduction + Results + Discussion is 4,736 words, or 8,735 with Methods. Patterns gives roughly 5,000–7,000 words as a guide and accepts longer articles. If the editor counts Methods, cut Methods first (the categorical-association and clustering subsections are the longest).

Elsevier's generative-AI policy (checked 5 November 2026) allows AI-assisted data
visualizations that are reproducibly derived from data and described in Methods.
It forbids creating or altering primary images such as histology, and forbids
general-purpose generative image tools for graphical abstracts. The figures
comply: every plot is drawn by code from `figure_data/`, H&E tiles are copied
unaltered, and Methods ("Figure preparation") and the AI declaration say so.

## Corrections relative to the preprint and the August draft

All checked against the released tables, not the website.

| Claim | Before | Now | Evidence |
|---|---|---|---|
| Patients | "6,745 slides from 6,745 patients", "one slide per patient" | **6,745 slides from 6,088 patients**: 312 patients have several slides, one THYM patient has 19. Statistics use one representative slide per patient. | `slide_histomics.parquet` (`case_id`); `histoatlas/_utils.py::select_case_representative_slides` |
| C-index gain over clinical + RNA | "+0.001 to +0.004, uniformly positive"; "+0.016 for mitotic index" | Median +0.0007 to +0.0027 across 18 cancer types (+0.0038 for pleomorphism, BRCA only), positive in only 50–61% of types; +0.016 could not be reproduced and was removed; marked as apparent (in-sample) | `c_index_comparison.parquet` |
| HRs after RNA adjustment | "changed only slightly" | HNSC lymphocyte density 0.76 → 0.72 (unchanged); CESC NN distance 1.34 → 1.18 and MESO mitotic index 2.00 → 1.40, both no longer significant | `adjusted_survival.parquet` |
| Standardized difference definition | Methods: median/TCGA SD. August figure script: mean/pooled SD | Median/TCGA SD everywhere, which reproduces the 31/32/34/34/30 pass counts | `export_figure_data.py::fig4` |
| Nuclear irregularity shift | 1.7–2.3 SD | 1.8–2.4 SD (definition above) | same |
| Source-site variance within cancer types | median 20.6% | median 21.3% across the 20 cancer types with a per-cancer decomposition | `batch_effect_pvca.parquet` |
| Inter-feature geometry | r = 0.84, P = 6.1 × 10⁻¹⁸⁵ | r = 0.84, P < 10⁻¹⁸⁰ (5.1 × 10⁻¹⁸⁶ on all slides) | recomputed |
| Fig. 4B transfer | only the 750-triple r = 0.787 | adds r = 0.56 across all 25,155 pairs, which is what the panel shows | recomputed |
| Fig. 3C, Fig. 5C annotations | disagreed with released values (9.6 × 10⁻⁷², 73%) | panels now show the released values (1.8 × 10⁻⁶⁸, 77%) | `figure_data/fig3.json`, `fig5.json` |
| Fig. 6 legend | "dense lymphocyte annotation among tumor cells" | the third intratumoral tile is mostly fibroblasts; the legend says so | visible in the tiles |
| S4 CPTAC clusters | unassigned slides filled with CPTAC's own cluster labels | unassigned slides drawn in gray | `cptac_cluster_assignments.parquet` |

## Figures: what changed visually

Every figure was redrawn from data. The panel content and order of the August
draft are kept, so the text maps one to one. Dense scatter plots (25,155 and
14,687 points) are now 2-D histograms. Fig. 3C uses percentile ranks, the scale
on which Spearman ρ is read. All overlapping labels were fixed, and the red/green
survival arrows were replaced with blue/orange triangles. Figures S1 and S2 were
swapped so that supplementary figures are cited in order.

## Author decisions still open (`TODO(author)` in the text)

1. Data DOI (Zenodo deposit of the derived tables, `figure_data/` and model weights). Patterns requires a persistent identifier.
2. Code DOI (archived commit).
3. AI declaration: Claude is named. Add any other tools used earlier in the project.
4. Scale bars on Fig. 6 tiles are omitted because the scan resolution of TCGA-A1-A0SE could not be read here. Add 50 µm bars once the microns-per-pixel value is confirmed from the slide header.

Settled: affiliation "Independent researcher"; no funding; no competing interests.
