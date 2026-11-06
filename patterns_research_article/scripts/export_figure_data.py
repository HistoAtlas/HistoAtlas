#!/usr/bin/env python
"""Export the data behind every figure of the Patterns submission to JSON.

Run from the repository root:

    uv run python patterns_research_article/scripts/export_figure_data.py

Every number drawn in a figure, and every statistic quoted in a legend, is
computed here from the frozen pipeline outputs (TCGA run 2026-03-09_15-53,
CPTAC run 2026-03-17_14-58, and data/paper/*). `build_figures.py` consumes the
JSON and draws the panels; it performs no statistics of its own.

Note: data/latest points at the CPTAC run, so the TCGA run is addressed
explicitly rather than through that symlink.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster.hierarchy import dendrogram, leaves_list, linkage
from scipy.spatial.distance import pdist

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

TCGA = ROOT / "data/runs/2026-03-09_15-53/parquet"
CPTAC = ROOT / "data/runs/2026-03-17_14-58/parquet"
PAPER = ROOT / "data/paper"
OUT = ROOT / "patterns_research_article/figure_data"
OUT.mkdir(parents=True, exist_ok=True)

SLIDE_A1 = "TCGA-A1-A0SE-01Z-00-DX1.04B09232-C6C4-46EF-AA2C-41D078D0A80A.svs"

# ---------------------------------------------------------------------------
# Feature vocabulary (six-group scheme used throughout the manuscript)
# ---------------------------------------------------------------------------
CATEGORIES = {
    "Composition": ["tumor_area_fraction", "stroma_area_fraction", "tumor_front_fraction"],
    "Density": [
        "intratumoral_lymphocyte_density", "stromal_lymphocyte_density",
        "intratumoral_eosinophil_density", "intratumoral_neutrophil_density",
        "fibroblast_density_stroma", "intratumoral_cancer_cell_density",
        "intratumoral_myeloid_lymphoid_tilt", "stromal_inflammatory_tilt",
    ],
    "Morphology": [
        "tumor_nuclear_area_median", "tumor_nuclear_eccentricity_median",
        "tumor_nuclear_irregularity_median", "tumor_nuclear_irregularity_iqr",
        "tumor_pleomorphism_index", "mitotic_index_tumor", "apoptotic_index_tumor",
    ],
    "Spatial": [
        "invasion_depth_p75", "tumor_lymphocyte_nn_distance_front",
        "fibroblast_lymphocyte_proximity_stroma", "deep_intratumoral_lymphocyte_fraction",
        "lymphocyte_infiltration_ratio_front", "myeloid_infiltration_ratio_front",
        "tumor_contact_fraction_stroma", "tumor_stroma_interface_density",
        "tumor_fibroblast_coupling_front", "interface_normalized_immune_pressure",
        "tumor_region_solidity",
    ],
    "Heterogeneity": [
        "lymphocyte_density_heterogeneity_tumor", "tumor_cell_density_heterogeneity",
        "stromal_cellularity_heterogeneity", "largest_tumor_component_share",
        "immune_desert_fraction",
    ],
    "Ratios": [
        "apoptosis_mitosis_ratio_tumor", "eosinophil_neutrophil_ratio_peritumoral",
        "peritumoral_fibroblast_enrichment", "peritumoral_immune_richness",
    ],
}
FEATURES = [f for fs in CATEGORIES.values() for f in fs]
CATEGORY_OF = {f: c for c, fs in CATEGORIES.items() for f in fs}
assert len(FEATURES) == 38 and len(set(FEATURES)) == 38

LABELS = {
    "tumor_area_fraction": "Tumor area fraction",
    "stroma_area_fraction": "Stroma area fraction",
    "tumor_front_fraction": "Tumor front fraction",
    "intratumoral_lymphocyte_density": "Intratumoral lymphocyte density",
    "stromal_lymphocyte_density": "Stromal lymphocyte density",
    "intratumoral_eosinophil_density": "Intratumoral eosinophil density",
    "intratumoral_neutrophil_density": "Intratumoral neutrophil density",
    "fibroblast_density_stroma": "Stromal fibroblast density",
    "intratumoral_cancer_cell_density": "Cancer cell density",
    "intratumoral_myeloid_lymphoid_tilt": "Myeloid/lymphoid tilt",
    "stromal_inflammatory_tilt": "Stromal inflammatory tilt",
    "tumor_nuclear_area_median": "Nuclear area",
    "tumor_nuclear_eccentricity_median": "Nuclear eccentricity",
    "tumor_nuclear_irregularity_median": "Nuclear irregularity",
    "tumor_nuclear_irregularity_iqr": "Nuclear irregularity IQR",
    "tumor_pleomorphism_index": "Pleomorphism index",
    "mitotic_index_tumor": "Mitotic index",
    "apoptotic_index_tumor": "Apoptotic index",
    "invasion_depth_p75": "Invasion depth (p75)",
    "tumor_lymphocyte_nn_distance_front": "Tumor-lymphocyte NN distance",
    "fibroblast_lymphocyte_proximity_stroma": "Fibroblast-lymphocyte proximity",
    "deep_intratumoral_lymphocyte_fraction": "Deep intratumoral lymphocyte frac.",
    "lymphocyte_infiltration_ratio_front": "Lymphocyte infiltration ratio",
    "myeloid_infiltration_ratio_front": "Myeloid infiltration ratio",
    "tumor_contact_fraction_stroma": "Tumor-stroma contact fraction",
    "tumor_stroma_interface_density": "Tumor-stroma interface density",
    "tumor_fibroblast_coupling_front": "Tumor-fibroblast coupling",
    "interface_normalized_immune_pressure": "Interface immune pressure",
    "tumor_region_solidity": "Tumor region solidity",
    "lymphocyte_density_heterogeneity_tumor": "Lymphocyte density heterogeneity",
    "tumor_cell_density_heterogeneity": "Tumor cell density heterogeneity",
    "stromal_cellularity_heterogeneity": "Stromal cellularity heterogeneity",
    "largest_tumor_component_share": "Largest tumor component share",
    "immune_desert_fraction": "Immune desert fraction",
    "apoptosis_mitosis_ratio_tumor": "Apoptosis/mitosis ratio",
    "eosinophil_neutrophil_ratio_peritumoral": "Eosinophil/neutrophil ratio",
    "peritumoral_fibroblast_enrichment": "Peritumoral fibroblast enrichment",
    "peritumoral_immune_richness": "Peritumoral immune richness",
}

CPTAC_CANCERS = ["BRCA", "HNSCC", "LUAD", "PAAD", "UCEC"]
CPTAC_TO_TCGA = {"HNSCC": "HNSC"}


def r(x, nd=4):
    """Round for JSON, mapping NaN/inf to None."""
    if x is None:
        return None
    try:
        xf = float(x)
    except (TypeError, ValueError):
        return x
    if not np.isfinite(xf):
        return None
    return round(xf, nd)


def bh(p: np.ndarray) -> np.ndarray:
    p = np.asarray(p, float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / np.arange(1, n + 1)
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.clip(q, 0, 1)
    return out


def dendro(link) -> dict:
    d = dendrogram(link, no_plot=True)
    return {"icoord": [[r(v, 2) for v in s] for s in d["icoord"]],
            "dcoord": [[r(v, 3) for v in s] for s in d["dcoord"]]}


def dump(name: str, obj: dict) -> None:
    with open(OUT / f"{name}.json", "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"wrote {name}.json ({(OUT / f'{name}.json').stat().st_size / 1e3:.0f} kB)")


# ---------------------------------------------------------------------------
# Shared tables
# ---------------------------------------------------------------------------
tcga = pd.read_parquet(TCGA / "slide_histomics.parquet")
cptac = pd.read_parquet(CPTAC / "slide_histomics.parquet")
tcga_corr = pd.read_parquet(TCGA / "precomputed_stats/feature_correlations.parquet")
cptac_corr = pd.read_parquet(CPTAC / "precomputed_stats/feature_correlations.parquet")
tcga_surv = pd.read_parquet(TCGA / "precomputed_stats/survival_associations.parquet")

cohort = {
    "tcga_slides": int(len(tcga)),
    "tcga_patients": int(tcga["case_id"].nunique()),
    "tcga_patients_multi_slide": int((tcga["case_id"].value_counts() > 1).sum()),
    "tcga_cancer_types": int(tcga["cancer_type"].nunique()),
    "tcga_slides_per_type": tcga["cancer_type"].value_counts().to_dict(),
    "tcga_patients_per_type": tcga.groupby("cancer_type")["case_id"].nunique().to_dict(),
    "cptac_slides": int(len(cptac)),
    "cptac_patients": int(cptac["case_id"].nunique()),
    "cptac_slides_per_type": cptac["cancer_type"].value_counts().to_dict(),
    "cptac_patients_per_type": cptac.groupby("cancer_type")["case_id"].nunique().to_dict(),
    "n_correlations": int(len(tcga_corr)),
    "n_correlations_significant": int(tcga_corr["is_significant"].sum()),
    "n_survival_models": int(len(tcga_surv)),
    "n_survival_valid": int(tcga_surv["cox_valid"].sum()),
    "n_survival_significant": int(tcga_surv["significant_adj"].fillna(False).sum()),
    "n_correction_families": int(
        pd.concat([tcga_corr["correction_family_id"], tcga_surv["correction_family_id"]]).nunique()
    ),
    "evidence_badges": tcga_surv["evidence_strength_badge"].value_counts().to_dict(),
}

# ===========================================================================
# Figure 1: measurement layer
# ===========================================================================
def fig1() -> None:
    X = tcga[FEATURES].dropna()
    corr = X.corr(method="spearman").loc[FEATURES, FEATURES].values
    link = linkage(pdist(corr, metric="euclidean"), method="ward")
    order = leaves_list(link).tolist()

    # UMAP (all slides)
    um = tcga[["cancer_type", "umap_1", "umap_2"]].dropna().sample(frac=1, random_state=42)
    cent = tcga.groupby("cancer_type")[["umap_1", "umap_2"]].median()
    top10 = tcga["cancer_type"].value_counts().nlargest(10).index.tolist()

    # Clusters
    comp = pd.read_parquet(TCGA / "clustering/l1_cluster_cancer_composition.parquet")
    meta = pd.read_parquet(TCGA / "clustering/l1_cluster_metadata.parquet")
    prof = pd.read_parquet(TCGA / "clustering/l1_cluster_feature_profiles.parquet")
    csurv = pd.read_parquet(TCGA / "cluster_analyses/cluster_survival_summary.parquet")
    cs = csurv[(csurv.cluster_level == "L1") & (csurv.analysis_type == "pan_cancer")
               & (csurv.endpoint == "os")]
    surv_rows = {}
    for _, row in cs.iterrows():
        surv_rows.setdefault(int(row.cluster_id), []).append({
            "model": row.model, "hr": r(row.hazard_ratio), "lo": r(row.hr_ci_lower),
            "hi": r(row.hr_ci_upper), "p": r(row.cox_p, 8), "p_adj": r(row.cox_p_adj, 8),
            "n": int(row.n_total) if pd.notna(row.n_total) else None,
            "n_cluster": int(row.n_cluster) if pd.notna(row.n_cluster) else None,
            "events_cluster": int(row.n_events_cluster) if pd.notna(row.n_events_cluster) else None,
            "valid": bool(row.cox_valid), "sig_adj": bool(row.cox_significant_adj),
            "covariates": row.covariates,
        })
    clusters = sorted(meta.cluster_id.tolist())
    piv = comp.pivot(index="cluster_id", columns="cancer_type", values="proportion").fillna(0)
    mat = prof.set_index("cluster_id")[FEATURES].clip(-2, 2)
    rl = linkage(pdist(mat.T.values), method="ward")
    cl = linkage(pdist(mat.values), method="ward")
    f_order = [FEATURES[i] for i in leaves_list(rl)]
    c_order = [int(mat.index[i]) for i in leaves_list(cl)]

    dump("fig1", {
        "cohort": cohort,
        "features": FEATURES, "labels": LABELS, "category_of": CATEGORY_OF,
        "categories": {k: len(v) for k, v in CATEGORIES.items()},
        "corr": {"order": order, "matrix": [[r(v, 3) for v in row] for row in corr],
                 "n": int(len(X)), "dendro": dendro(link)},
        "umap": {"x": [r(v, 3) for v in um.umap_1], "y": [r(v, 3) for v in um.umap_2],
                 "ct": um.cancer_type.tolist(),
                 "centroids": {ct: [r(cent.loc[ct, "umap_1"], 3), r(cent.loc[ct, "umap_2"], 3)]
                               for ct in cent.index},
                 "labelled": top10},
        "clusters": {
            "ids": clusters,
            "n": dict(zip(meta.cluster_id.astype(int).astype(str), meta.n_samples.astype(int))),
            "names": dict(zip(meta.cluster_id.astype(int).astype(str), meta.auto_name)),
            "composition": {str(c): {ct: r(v, 4) for ct, v in piv.loc[c].items() if v > 0}
                            for c in clusters},
            "survival": {str(k): v for k, v in surv_rows.items()},
            "profile_features": f_order, "profile_clusters": c_order,
            "profile": {str(c): [r(mat.loc[c, f], 3) for f in f_order] for c in c_order},
        },
    })


# ===========================================================================
# Figure 2: programs
# ===========================================================================
def fig2() -> None:
    load = pd.read_parquet(PAPER / "histomic_programs/loadings.parquet").set_index("feature")
    ts = pd.read_parquet(PAPER / "histomic_programs/tcga_scores.parquet")
    cs = pd.read_parquet(PAPER / "histomic_programs/cptac_scores.parquet")
    pw = pd.read_parquet(PAPER / "histomic_programs/program_pathway_correlations.parquet")
    names = json.load(open(PAPER / "histomic_programs/program_names.json"))
    progs = [f"program_{i}" for i in range(1, 7)]

    dist = {}
    for p in progs:
        a, b = ts[p].dropna().values, cs[p].dropna().values
        ks = stats.ks_2samp(a, b)
        lo = min(np.percentile(a, 0.5), np.percentile(b, 0.5))
        hi = max(np.percentile(a, 99.5), np.percentile(b, 99.5))
        grid = np.linspace(lo, hi, 80)
        dist[p] = {
            "ks_D": r(ks.statistic, 4), "ks_p": r(ks.pvalue, 12), "n_tcga": len(a), "n_cptac": len(b),
            "grid": [r(v, 3) for v in grid],
            "kde_tcga": [r(v, 5) for v in stats.gaussian_kde(a)(grid)],
            "kde_cptac": [r(v, 5) for v in stats.gaussian_kde(b)(grid)],
            "q_tcga": [r(v, 3) for v in np.percentile(a, [5, 25, 50, 75, 95])],
            "q_cptac": [r(v, 3) for v in np.percentile(b, [5, 25, 50, 75, 95])],
        }
    pw = pw.copy()
    pw["q"] = bh(pw.p_value.values)
    pathways = sorted(pw.pathway.unique())
    piv = pw.pivot(index="program", columns="pathway", values="rho").loc[progs, pathways]
    q = pw.pivot(index="program", columns="pathway", values="q").loc[progs, pathways]
    # order pathways by Ward clustering on their program profiles
    po = leaves_list(linkage(pdist(piv.T.values), method="ward"))
    pathways_o = [pathways[i] for i in po]
    top = {p: pw[pw.program == p].sort_values("rho", ascending=False).head(3)[["pathway", "rho"]]
           .values.tolist() for p in progs}
    # feature ordering for loadings: by dominant program then loading
    dom = load[progs].abs().idxmax(axis=1)
    feat_order = sorted(FEATURES, key=lambda f: (progs.index(dom[f]), -abs(load.loc[f, dom[f]])))
    dump("fig2", {
        "programs": progs, "names": names, "labels": LABELS,
        "loadings": {f: [r(load.loc[f, p], 4) for p in progs] for f in feat_order},
        "feature_order": feat_order,
        "n_nonzero": {p: int((load[p].abs() > 1e-9).sum()) for p in progs},
        "dist": dist,
        "pathways": pathways_o,
        "pathway_rho": {p: [r(piv.loc[p, w], 3) for w in pathways_o] for p in progs},
        "pathway_sig": {p: [bool(q.loc[p, w] < 0.05) for w in pathways_o] for p in progs},
        "top_pathways": {p: [[w, r(v, 3)] for w, v in top[p]] for p in progs},
        "n_tcga": int(len(ts)), "n_cptac": int(len(cs)),
    })


# ===========================================================================
# Figure 3: immune topology
# ===========================================================================
def fig3() -> None:
    feats = ["intratumoral_lymphocyte_density", "stromal_lymphocyte_density"]
    s = tcga_surv[tcga_surv.feature.isin(feats) & (tcga_surv.endpoint == "os")
                  & (tcga_surv.model == "adjusted")]
    forest = []
    for _, row in s.iterrows():
        forest.append({
            "ct": row.cancer_type, "feature": row.feature, "hr": r(row.hazard_ratio),
            "lo": r(row.hr_ci_lower), "hi": r(row.hr_ci_upper), "p_adj": r(row.p_value_adj, 8),
            "n": int(row.n_samples) if pd.notna(row.n_samples) else None,
            "events": int(row.n_events) if pd.notna(row.n_events) else None,
            "badge": row.evidence_strength_badge, "valid": bool(row.cox_valid),
        })
    km = pd.read_parquet(TCGA / "precomputed_stats/km_curve_data.parquet")
    k = km[(km.cancer_type == "BRCA") & (km.feature == "intratumoral_lymphocyte_density")
           & (km.endpoint == "os") & km.group.isin(["High", "Low"])]
    kmd = {}
    for _, row in k.iterrows():
        t = np.asarray(row.time_points, float)
        sp = np.asarray(row.survival_probs, float)
        cens = np.asarray(row.censoring_times if row.censoring_times is not None else [], float)
        cens = cens[(cens > 0) & (cens < t.max())]
        cprob = [float(sp[max(0, np.searchsorted(t, c, side="right") - 1)]) for c in cens]
        nar = np.asarray(row.n_at_risk, float)
        risk_at = {}
        for tt in [0, 20, 40, 60, 80, 100, 120]:
            idx = np.searchsorted(t, tt, side="left")
            risk_at[tt] = int(nar[idx]) if idx < len(nar) else 0
        kmd[row.group] = {
            "t": [r(v, 2) for v in t], "s": [r(v, 4) for v in sp],
            "lo": [r(v, 4) for v in row.ci_lower], "hi": [r(v, 4) for v in row.ci_upper],
            "cens_t": [r(v, 2) for v in cens], "cens_s": [r(v, 4) for v in cprob],
            "n": int(row.n_samples), "events": int(row.n_events), "risk": risk_at,
            "stratification": row.stratification,
        }
    # scatter: NN distance vs CD8A, BRCA (one slide per case, as in the pipeline)
    expr = pd.read_parquet(ROOT / "data/processed/molecular/tcga_expression_curated.parquet")
    b = tcga[tcga.cancer_type == "BRCA"].groupby("case_id")["tumor_lymphocyte_nn_distance_front"].mean()
    e = expr[expr.cancer_type == "BRCA"].drop_duplicates("case_id").set_index("case_id")["CD8A"]
    df = pd.concat([b, e], axis=1, join="inner").dropna()
    # percentile ranks: the scale on which a Spearman coefficient is a Pearson coefficient
    zx = df.iloc[:, 0].rank(pct=True)
    zy = df.iloc[:, 1].rank(pct=True)
    slope, intercept = np.polyfit(zx, zy, 1)
    st = tcga_corr[(tcga_corr.cancer_type == "BRCA")
                   & (tcga_corr.histomic_feature == "tumor_lymphocyte_nn_distance_front")
                   & (tcga_corr.molecular_feature == "CD8A") & (tcga_corr.molecular_type == "expression")
                   & (tcga_corr.model == "unadjusted")].iloc[0]
    # genes
    g = tcga_corr[(tcga_corr.cancer_type == "BRCA")
                  & (tcga_corr.histomic_feature == "intratumoral_lymphocyte_density")
                  & (tcga_corr.molecular_type == "expression") & (tcga_corr.model == "adjusted")
                  & (tcga_corr.spearman_p_adj < 0.05)].sort_values("spearman_rho", ascending=False)
    genes = pd.concat([g.head(10), g.tail(5)])
    dump("fig3", {
        "forest": forest, "km": kmd,
        "scatter": {"x": [r(v, 3) for v in zx], "y": [r(v, 3) for v in zy], "n_plotted": int(len(df)),
                    "slope": r(slope), "intercept": r(intercept),
                    "rho": r(st.spearman_rho, 3), "lo": r(st.spearman_ci_lower, 3),
                    "hi": r(st.spearman_ci_upper, 3), "p_adj": r(st.spearman_p_adj, 300),
                    "n": int(st.n_samples), "covariates": st.covariates_used},
        "genes": [{"gene": row.molecular_feature, "rho": r(row.spearman_rho, 3),
                   "lo": r(row.spearman_ci_lower, 3), "hi": r(row.spearman_ci_upper, 3),
                   "p_adj": r(row.spearman_p_adj, 300), "n": int(row.n_samples)}
                  for _, row in genes.iterrows()],
        "n_sig_genes": int(len(g)),
    })


# ===========================================================================
# Figure 4: transfer to CPTAC
# ===========================================================================
def hist2d(x, y, lim=0.8, nb=64):
    H, xe, ye = np.histogram2d(x, y, bins=nb, range=[[-lim, lim], [-lim, lim]])
    cells = [[i, j, int(H[i, j])] for i in range(nb) for j in range(nb) if H[i, j] > 0]
    return {"nb": nb, "lim": lim, "cells": cells, "max": int(H.max())}


def fig4() -> None:
    # A: standardized differences, two definitions
    smd_med, smd_pooled = {}, {}
    within = {}
    for cc in CPTAC_CANCERS:
        tc = CPTAC_TO_TCGA.get(cc, cc)
        a = tcga[tcga.cancer_type == tc]
        bq = cptac[cptac.cancer_type == cc]
        vm, vp = [], []
        for f in FEATURES:
            ta, cb = a[f].dropna(), bq[f].dropna()
            sd_t = ta.std(ddof=1)
            vm.append((cb.median() - ta.median()) / sd_t if sd_t > 0 else np.nan)
            pooled = np.sqrt(((len(ta) - 1) * ta.var(ddof=1) + (len(cb) - 1) * cb.var(ddof=1))
                             / (len(ta) + len(cb) - 2))
            vp.append((cb.mean() - ta.mean()) / pooled if pooled > 0 else np.nan)
        smd_med[cc] = [r(v, 3) for v in vm]
        smd_pooled[cc] = [r(v, 3) for v in vp]
        within[cc] = int(np.sum(np.abs(np.array(vm)) <= 1))
    # inter-feature correlation geometry
    ct_ = tcga[FEATURES].corr(method="spearman").values
    cc_ = cptac[FEATURES].corr(method="spearman").values
    iu = np.triu_indices(38, 1)
    geo = stats.pearsonr(ct_[iu], cc_[iu])

    # B: TCGA vs CPTAC rho (expression, unadjusted)
    f1 = (tcga_corr.molecular_type == "expression") & (tcga_corr.model == "unadjusted") & (tcga_corr.cancer_type != "PANCAN")
    f2 = (cptac_corr.molecular_type == "expression") & (cptac_corr.model == "unadjusted") & (cptac_corr.cancer_type != "PANCAN")
    t1 = tcga_corr.loc[f1, ["cancer_type", "histomic_feature", "molecular_feature", "spearman_rho"]].rename(columns={"spearman_rho": "t"})
    c1 = cptac_corr.loc[f2, ["cancer_type", "histomic_feature", "molecular_feature", "spearman_rho"]].rename(columns={"spearman_rho": "c"})
    c1["ct"] = c1.cancer_type.replace(CPTAC_TO_TCGA)
    m = t1.merge(c1, left_on=["cancer_type", "histomic_feature", "molecular_feature"],
                 right_on=["ct", "histomic_feature", "molecular_feature"]).dropna(subset=["t", "c"])
    pr = stats.pearsonr(m.t, m.c)
    same_sign = float(np.mean(np.sign(m.t) == np.sign(m.c)))
    # strongest TCGA associations: top |rho| per feature-cancer (top 5 genes) -> 750 = 5*38*... recompute as top-5 per (feature, cancer)
    m["abs_t"] = m.t.abs()
    top = m.sort_values("abs_t", ascending=False).groupby(["cancer_type_x", "histomic_feature"]).head(4)
    prt = stats.pearsonr(top.t, top.c)

    # C: mRNA vs protein (CPTAC)
    mp = pd.read_parquet(CPTAC / "precomputed_stats/mrna_vs_protein_comparison.parquet")
    mp = mp[mp.model == "unadjusted"].dropna(subset=["mrna_rho", "protein_rho"])
    both = mp[mp.both_significant.fillna(False).astype(bool)]
    prc = stats.pearsonr(mp.mrna_rho, mp.protein_rho)
    conc = int(both.same_direction.sum())
    ci = stats.binomtest(conc, len(both)).proportion_ci(method="exact")

    # D: evidence triangulation
    prot = pd.read_parquet(CPTAC / "precomputed_stats/proteomics_correlations.parquet")
    axes = [("Immune", "intratumoral_lymphocyte_density", ["CD8A", "GZMB", "TIGIT"]),
            ("Proliferation", "mitotic_index_tumor", ["MKI67", "PLK1", "TOP2A"]),
            ("EMT", "tumor_contact_fraction_stroma", ["VIM", "CDH1", "CDH2"]),
            ("Hormonal", "tumor_pleomorphism_index", ["ESR1", "PGR"])]
    rows = []
    for ax, f, gs in axes:
        sv = tcga_surv[(tcga_surv.feature == f) & (tcga_surv.endpoint == "os") & (tcga_surv.model == "unadjusted")]
        for gname in gs:
            def sig(df, typ=True):
                q = (df.histomic_feature == f) & (df.molecular_feature == gname) & (df.model == "unadjusted") & (df.cancer_type != "PANCAN")
                if typ:
                    q &= df.molecular_type == "expression"
                return bool(df[q].is_significant.any())
            rows.append({"axis": ax, "feature": f, "label": LABELS[f], "gene": gname,
                         "sig": [sig(tcga_corr), sig(cptac_corr), sig(prot, False),
                                 bool(sv.significant_adj.fillna(False).any())]})
    dump("fig4", {
        "features": FEATURES, "labels": LABELS, "category_of": CATEGORY_OF,
        "cancers": CPTAC_CANCERS, "smd_median_tcgaSD": smd_med, "smd_pooled_mean": smd_pooled,
        "within_1sd": within,
        "n_tcga": {cc: int((tcga.cancer_type == CPTAC_TO_TCGA.get(cc, cc)).sum()) for cc in CPTAC_CANCERS},
        "n_cptac": {cc: int((cptac.cancer_type == cc).sum()) for cc in CPTAC_CANCERS},
        "geometry": {"r": r(geo.statistic, 3), "p": r(geo.pvalue, 300), "n_pairs": int(len(iu[0]))},
        "transfer": {"hist": hist2d(m.t.values, m.c.values), "n": int(len(m)), "r": r(pr.statistic, 3),
                     "p": r(pr.pvalue, 300), "same_sign": r(same_sign, 3),
                     "mean_abs_t": r(m.t.abs().mean(), 3), "mean_abs_c": r(m.c.abs().mean(), 3),
                     "top_r": r(prt.statistic, 3), "top_n": int(len(top))},
        "protein": {"hist": hist2d(mp.mrna_rho.values, mp.protein_rho.values), "n": int(len(mp)),
                    "r": r(prc.statistic, 3), "both_x": [r(v, 3) for v in both.mrna_rho],
                    "both_y": [r(v, 3) for v in both.protein_rho],
                    "both_same": [bool(v) for v in both.same_direction],
                    "n_both": int(len(both)), "concordant": conc,
                    "conc_ci": [r(ci.low, 4), r(ci.high, 4)],
                    "median_delta": r((both.protein_rho - both.mrna_rho).median(), 4),
                    "median_delta_all": r(mp.delta_rho.median(), 4)},
        "triangulation": rows,
    })


# ===========================================================================
# Figure 5: added value
# ===========================================================================
def fig5() -> None:
    sv = pd.read_parquet(PAPER / "bulk_omics_adjusted_survival/adjusted_survival.parquet")
    sv["model_type"] = sv.model_type.replace({"base_clinical": "base"})
    base = sv[sv.model_type == "base"]
    adj = sv[sv.model_type == "omics_adjusted"]
    common = set(base.feature) & set(adj.feature)
    best = base[base.feature.isin(common)].sort_values("p_value").drop_duplicates("feature")
    best = best[best.p_value < 0.05]
    forest = []
    for _, row in best.iterrows():
        a = adj[(adj.feature == row.feature) & (adj.cancer_type == row.cancer_type)]
        if a.empty:
            continue
        a = a.iloc[0]
        forest.append({"feature": row.feature, "label": LABELS[row.feature], "ct": row.cancer_type,
                       "base": [r(row.hazard_ratio), r(row.hr_ci_lower), r(row.hr_ci_upper), r(row.p_value, 8)],
                       "adj": [r(a.hazard_ratio), r(a.hr_ci_lower), r(a.hr_ci_upper), r(a.p_value, 8)],
                       "n": int(row.n_samples), "events": int(row.n_events), "covariates": a.covariates})
    forest.sort(key=lambda d: d["base"][0])
    ci = pd.read_parquet(PAPER / "bulk_omics_adjusted_survival/c_index_comparison.parquet")
    cb = ci.dropna(subset=["c_clinical", "c_clinical_histo"]).sort_values("n_samples", ascending=False).drop_duplicates("feature")
    cidx = [{"feature": row.feature, "label": LABELS[row.feature], "ct": row.cancer_type,
             "rna": row.rna_covariate,
             "c": [r(row.c_clinical), r(row.c_clinical_rna), r(row.c_clinical_histo), r(row.c_clinical_rna_histo)],
             "n": int(row.n_samples), "events": int(row.n_events)} for _, row in cb.iterrows()]
    cv = ci.dropna(subset=["c_clinical", "c_clinical_rna", "c_clinical_histo", "c_clinical_rna_histo"]).copy()
    cv["d_histo_over_rna"] = cv.c_clinical_rna_histo - cv.c_clinical_rna
    cv["d_histo_over_clin"] = cv.c_clinical_histo - cv.c_clinical
    cidx_summary = {f: {"n_cancers": int(len(g)), "median_d_histo_over_rna": r(g.d_histo_over_rna.median(), 4),
                        "min": r(g.d_histo_over_rna.min(), 4), "max": r(g.d_histo_over_rna.max(), 4),
                        "frac_positive": r((g.d_histo_over_rna > 0).mean(), 3),
                        "median_d_histo_over_clin": r(g.d_histo_over_clin.median(), 4)}
                    for f, g in cv.groupby("feature")}
    pc = pd.read_parquet(PAPER / "protein_after_rna/partial_correlations.parquet")
    pcv = pc.dropna(subset=["protein_rho", "protein_rho_partial_mrna"])
    sig = pcv[pcv.protein_partial_p_adj < 0.05]
    retained = float(np.mean(pcv.protein_rho_partial_mrna.abs() > 0.5 * pcv.protein_rho.abs()))
    top = sig.reindex(sig.protein_rho_partial_mrna.abs().sort_values(ascending=False).index).drop_duplicates("gene").head(6)
    dump("fig5", {
        "forest": forest, "cindex": cidx, "cindex_summary": cidx_summary,
        "partial": {"hist": hist2d(pcv.protein_rho.values, pcv.protein_rho_partial_mrna.values, lim=0.8, nb=64),
                    "n": int(len(pcv)), "n_total": int(len(pc)), "n_sig": int(len(sig)),
                    "sig_by_ct": sig.cancer_type.value_counts().to_dict(),
                    "sig_x": [r(v, 3) for v in sig.protein_rho], "sig_y": [r(v, 3) for v in sig.protein_rho_partial_mrna],
                    "sig_ct": sig.cancer_type.tolist(), "retained_half": r(retained, 4),
                    "labels": [{"gene": row.gene, "ct": row.cancer_type, "feature": row.histomic_feature,
                                "x": r(row.protein_rho, 3), "y": r(row.protein_rho_partial_mrna, 3)}
                               for _, row in top.iterrows()]},
    })


# ===========================================================================
# Figure 6: provenance (slide TCGA-A1-A0SE)
# ===========================================================================
def fig6() -> None:
    from PIL import Image
    tdir = ROOT / "web/public/bundles/v1/tiles" / SLIDE_A1
    mask = Image.open(tdir / "mask.png")
    s = tcga_surv[(tcga_surv.cancer_type == "BRCA") & (tcga_surv.endpoint == "os") & (tcga_surv.model == "adjusted")
                  & tcga_surv.feature.isin(["intratumoral_lymphocyte_density", "stromal_lymphocyte_density"])]
    forest = {row.feature: {"hr": r(row.hazard_ratio), "lo": r(row.hr_ci_lower), "hi": r(row.hr_ci_upper),
                            "p_adj": r(row.p_value_adj, 8), "n": int(row.n_samples), "events": int(row.n_events)}
              for _, row in s.iterrows()}
    snap = json.load(open(ROOT / "paper_workspace/figures/fig6/data_snapshot.json"))
    row = tcga[tcga.slide_name.str.startswith(SLIDE_A1[:23])]
    vals = {}
    if len(row):
        for f in ["intratumoral_lymphocyte_density", "stromal_lymphocyte_density"]:
            v = float(row[f].iloc[0])
            pct = float((tcga.loc[tcga.cancer_type == "BRCA", f] < v).mean() * 100)
            vals[f] = {"value": r(v, 2), "brca_percentile": r(pct, 1)}
    dump("fig6", {"slide": SLIDE_A1, "mask_size": list(mask.size), "forest": forest,
                  "tiles_intratumoral": snap["intratumoral_tiles"], "tiles_stromal": snap["stromal_tiles"],
                  "slide_values": vals, "max_tile": [243, 139], "tile_px": 224})


# ===========================================================================
# Supplementary figures
# ===========================================================================
def figS1() -> None:
    pw = tcga_corr[(tcga_corr.molecular_type == "pathway") & (tcga_corr.model == "unadjusted")]
    hm = pw.groupby(["histomic_feature", "molecular_feature"]).spearman_rho.mean().unstack()
    hm = hm.loc[[f for f in FEATURES if f in hm.index]]
    ro = leaves_list(linkage(pdist(hm.fillna(0).values), method="ward"))
    co = leaves_list(linkage(pdist(hm.fillna(0).T.values), method="ward"))
    feats = [hm.index[i] for i in ro]
    paths = [hm.columns[i] for i in co]
    pa = tcga_corr[(tcga_corr.cancer_type == "PANCAN") & (tcga_corr.model == "adjusted")]
    dists = {}
    edges = np.linspace(-0.7, 0.7, 57)
    for t in ["expression", "pathway", "cnv"]:
        d = pa[pa.molecular_type == t]
        sg = d[d.spearman_p_adj < 0.05].spearman_rho.values
        ns = d[~(d.spearman_p_adj < 0.05)].spearman_rho.values
        dists[t] = {"edges": [r(v, 4) for v in edges], "sig": np.histogram(sg, edges)[0].tolist(),
                    "ns": np.histogram(ns, edges)[0].tolist(), "n": int(len(d)), "n_sig": int(len(sg))}
    dump("figS1", {"features": feats, "pathways": paths, "labels": LABELS, "category_of": CATEGORY_OF,
                   "matrix": [[r(hm.loc[f, p], 3) for p in paths] for f in feats],
                   "n_cancer_types": int(pw.cancer_type.nunique()), "dists": dists})


def figS2() -> None:
    imm = pd.read_parquet(TCGA / "cluster_analyses/cluster_immune_enrichment.parquet")
    imm = imm[(imm.cancer_type == "PAN") & (imm.cluster_level == "L1")]
    pw = pd.read_parquet(TCGA / "cluster_analyses/cluster_pathway_enrichment.parquet")
    pw = pw[(pw.cancer_type == "PAN") & (pw.cluster_level == "L1")]
    subtypes = ["C1", "C2", "C3", "C4", "C6"]
    clusters = sorted(imm.cluster_id.unique().astype(int).tolist())
    orv = imm.pivot_table(index="cluster_id", columns="immune_subtype", values="odds_ratio", aggfunc="first")
    sgv = imm.pivot_table(index="cluster_id", columns="immune_subtype", values="is_significant", aggfunc="first")
    pdl = pw.pivot_table(index="pathway_name", columns="cluster_id", values="cliffs_delta", aggfunc="first")
    psg = pw.pivot_table(index="pathway_name", columns="cluster_id", values="is_significant", aggfunc="first")
    ro = leaves_list(linkage(pdist(pdl.fillna(0).values), method="ward"))
    paths = [pdl.index[i] for i in ro]
    dump("figS2", {
        "clusters": clusters, "subtypes": subtypes,
        "log2or": {str(c): [r(np.log2(max(float(orv.loc[c, s]), 0.01)) if s in orv.columns and pd.notna(orv.loc[c, s]) else None, 3) for s in subtypes] for c in clusters},
        "or_sig": {str(c): [bool(sgv.loc[c, s]) if s in sgv.columns and pd.notna(sgv.loc[c, s]) else False for s in subtypes] for c in clusters},
        "pathways": paths,
        "delta": {str(c): [r(pdl.loc[p, c], 3) for p in paths] for c in clusters},
        "delta_sig": {str(c): [bool(psg.loc[p, c]) if pd.notna(psg.loc[p, c]) else False for p in paths] for c in clusters},
    })


def figS3() -> None:
    pv = pd.read_parquet(TCGA / "qc/batch_effect_pvca.parquet")
    sil = pd.read_parquet(TCGA / "qc/batch_effect_silhouette.parquet")
    per = pv[pv.scope == "per_cancer"].sort_values("batch_variance_proportion", ascending=False)
    pan = pv[pv.scope == "pan_cancer"].iloc[0]
    d = tcga_surv[tcga_surv.cancer_type != "PANCAN"]
    order = d.groupby("cancer_type").n_samples.median().sort_values(ascending=False)
    mdes = {}
    for ct in order.index:
        v = d.loc[d.cancer_type == ct, "mdes_hr_harmful"].dropna().values
        mdes[ct] = {"n": int(order[ct]), "q": [r(x, 3) for x in np.percentile(v, [5, 25, 50, 75, 95])] if len(v) else None,
                    "count": int(len(v))}
    dump("figS3", {
        "pvca": [{"ct": row.cancer_type, "n": int(row.n_samples), "batch": r(row.batch_variance_proportion, 4),
                  "bio": r(row.biological_variance_proportion, 4), "resid": r(row.residual_variance_proportion, 4)}
                 for _, row in per.iterrows()],
        "pan": {"batch": r(pan.batch_variance_proportion, 4), "bio": r(pan.biological_variance_proportion, 4),
                "resid": r(pan.residual_variance_proportion, 4), "n": int(pan.n_samples)},
        "median_batch_per_cancer": r(per.batch_variance_proportion.median(), 4),
        "silhouette": {row.cancer_type: r(row.silhouette_score, 4) for _, row in sil.iterrows()},
        "mdes": mdes,
    })


def figS4() -> None:
    a = pd.read_parquet(PAPER / "atlas_transfer/cptac_cluster_assignments.parquet")
    comp = pd.read_parquet(PAPER / "atlas_transfer/transfer_enrichment_comparison.parquet")
    conc = pd.read_parquet(PAPER / "atlas_transfer/enrichment_concordance.parquet")
    ari = json.load(open(PAPER / "atlas_transfer/cluster_ari.json"))
    cp = cptac[["case_id", "cancer_type", "umap_1", "umap_2", "cluster_l1"]].merge(
        a[["case_id", "transferred_cluster"]], on="case_id", how="left")
    # slides without a transferred label (incomplete feature vectors) are drawn in grey
    cp["cl"] = cp.transferred_cluster.fillna(-1).astype(int)
    tt = tcga[["cancer_type", "umap_1", "umap_2", "cluster_l1"]].dropna().sample(frac=1, random_state=1)
    cp = cp.dropna(subset=["umap_1"]).sample(frac=1, random_state=1)
    ov = stats.spearmanr(comp.tcga_cliffs_delta, comp.cptac_cliffs_delta, nan_policy="omit")
    dump("figS4", {
        "tcga": {"x": [r(v, 3) for v in tt.umap_1], "y": [r(v, 3) for v in tt.umap_2],
                 "ct": tt.cancer_type.tolist(), "cl": tt.cluster_l1.astype(int).tolist()},
        "cptac": {"x": [r(v, 3) for v in cp.umap_1], "y": [r(v, 3) for v in cp.umap_2],
                  "ct": cp.cancer_type.tolist(), "cl": cp.cl.tolist(),
                  "n_transferred": int(cp.transferred_cluster.notna().sum())},
        "comparison": {"x": [r(v, 3) for v in comp.tcga_cliffs_delta], "y": [r(v, 3) for v in comp.cptac_cliffs_delta],
                       "cl": comp.cluster_id.astype(int).tolist(), "rho": r(ov.statistic, 3), "p": r(ov.pvalue, 8),
                       "n": int(comp.dropna(subset=["tcga_cliffs_delta", "cptac_cliffs_delta"]).shape[0])},
        "per_cluster": [{"cl": int(row.cluster_id), "rho": r(row.spearman_rho, 3), "p": r(row.spearman_p, 6),
                         "n": int(row.n_pathways)} for _, row in conc.iterrows()],
        "ari": {k: r(v, 4) for k, v in ari.items()},
    })


if __name__ == "__main__":
    for fn in [fig1, fig2, fig3, fig4, fig5, fig6, figS1, figS2, figS3, figS4]:
        fn()
    dump("cohort", cohort)
