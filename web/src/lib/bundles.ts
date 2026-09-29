/**
 * Downloadable result bundles, built from the static API at build time (Node only).
 * One zip of CSV tables per cohort, plus one zip with every cohort.
 * The zips are uploaded to R2 at deploy time (scripts/deploy.sh); only sizes.json ships with the site.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';

const API = 'public/api';
const CITATION = 'https://arxiv.org/abs/2603.13155';

type Row = Record<string, unknown>;
type Files = Record<string, Uint8Array>;

const readJson = (path: string) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null);
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);
const stem = (file: string) => file.replace(/\.json$/, '');

function cell(value: unknown): string {
  if (value == null) return '';
  // 6 significant digits: the pipeline's 17-digit floats double the download for no information
  if (typeof value === 'number') return String(Number.isInteger(value) ? value : Number(value.toPrecision(6)));
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => r[k] !== undefined)))];
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

export function listCohorts(): { dataset: string; cohort: string }[] {
  const manifest: Record<string, { cancerTypes: string[] }> = readJson(`${API}/_manifests/datasets.json`) ?? {};
  return Object.entries(manifest).flatMap(([dataset, info]) =>
    info.cancerTypes.map((cohort) => ({ dataset, cohort })),
  );
}

function cohortTables(dataset: string, cohort: string): Record<string, Row[]> {
  const base = `${API}/${dataset}`;
  const atlas = readJson(`${base}/atlas/${cohort}.json`);
  const clusterName = new Map<string, string>((atlas?.clusters ?? []).map((c: Row) => [c.id, c.name]));

  const slides: Row[] = (atlas?.slides ?? []).map((s: Row & { features: Row }) => ({
    slide_id: s.id,
    cancer_type: s.cancerType,
    umap_x: s.x,
    umap_y: s.y,
    cluster_id: s.clusterId,
    cluster_name: clusterName.get(s.clusterId as string),
    immune_subtype: s.immuneSubtype,
    stage: s.stage,
    grade: s.grade,
    ...s.features,
  }));

  const features: Row[] = (atlas?.featureMetadata ?? []).map((f: Row & { quantiles: Row }) => ({
    ...f,
    ...f.quantiles,
    quantiles: undefined,
    histogramBins: undefined,
  }));

  const clusters: Row[] = [];
  const clusterSurvival: Row[] = [];
  const enrichments: Record<string, Row[]> = {};
  for (const file of list(`${base}/cluster/${cohort}`).filter((f) => f.endsWith('.json'))) {
    const c = readJson(`${base}/cluster/${cohort}/${file}`);
    if (!c?.id) continue;
    clusters.push({ cluster_id: c.id, name: c.name, n_slides: c.nSlides });
    for (const [endpoint, summary] of Object.entries<Row>(c.survivalSummary ?? {})) {
      clusterSurvival.push({ cluster_id: c.id, endpoint, ...summary });
    }
    for (const [kind, rows] of Object.entries<Row[]>(c.enrichments ?? {})) {
      (enrichments[kind] ??= []).push(...rows.map((r) => ({ cluster_id: c.id, ...r })));
    }
  }
  clusters.sort((a, b) => Number(a.cluster_id) - Number(b.cluster_id));

  const survival: Row[] = [];
  const survivalDir = `${base}/associations/survival/${cohort}`;
  for (const endpoint of list(survivalDir)) {
    for (const file of list(`${survivalDir}/${endpoint}`)) {
      const rows: Row[] = readJson(`${survivalDir}/${endpoint}/${file}`)?.associations ?? [];
      survival.push(...rows.map((r) => ({ endpoint, model: stem(file), ...r })));
    }
  }

  const correlations: Row[] = [];
  const correlationDir = `${base}/associations/correlations/${cohort}`;
  for (const model of list(correlationDir).filter((f) => !f.endsWith('.json'))) {
    for (const file of list(`${correlationDir}/${model}`)) {
      const rows: Row[] = readJson(`${correlationDir}/${model}/${file}`)?.associations ?? [];
      correlations.push(...rows.map((r) => ({ model, ...r })));
    }
  }

  const categorical: Row[] = [];
  const categoricalDir = `${base}/associations/categorical/${cohort}`;
  for (const file of list(categoricalDir)) {
    const vars: Record<string, Row[]> = readJson(`${categoricalDir}/${file}`)?.categoricalVars ?? {};
    for (const [categoricalVar, rows] of Object.entries(vars)) {
      categorical.push(...rows.map((r) => ({ model: stem(file), categoricalVar, ...r })));
    }
  }

  return {
    slides,
    features,
    clusters,
    cluster_survival: clusterSurvival,
    ...Object.fromEntries(Object.entries(enrichments).map(([kind, rows]) => [`cluster_enrichment_${kind}`, rows])),
    survival_associations: survival,
    molecular_correlations: correlations,
    categorical_associations: categorical,
  };
}

function readme(dataset: string, cohort: string, tables: Record<string, Row[]>): string {
  const atlas = readJson(`${API}/${dataset}/atlas/${cohort}.json`);
  return [
    `HistoAtlas results: ${dataset.toUpperCase()} ${cohort}`,
    `Data version: ${atlas?.dataVersion ?? 'unknown'} (${String(atlas?.dataUpdatedAt ?? '').slice(0, 10)})`,
    `Source: https://histoatlas.com/${dataset}/${cohort}/atlas/`,
    `Cite: ${CITATION}`,
    '',
    'Tables (CSV, UTF-8, empty cell = not available):',
    ...Object.entries(tables).map(([name, rows]) => `  ${name}.csv  ${rows.length.toLocaleString('en-US')} rows`),
    '',
    'slides.csv has one row per slide: UMAP coordinates, cluster, clinical labels and histomic features.',
    'features.csv describes each histomic feature (unit, range, quantiles).',
    'Adjusted p-values use the correction stated on the site (Benjamini-Hochberg).',
    'Numbers are rounded to 6 significant digits.',
    '',
  ].join('\n');
}

const zipCache = new Map<string, Uint8Array>();

function cohortFiles(dataset: string, cohort: string): Files {
  const tables = cohortTables(dataset, cohort);
  const files: Files = { 'README.txt': strToU8(readme(dataset, cohort, tables)) };
  for (const [name, rows] of Object.entries(tables)) {
    if (rows.length) files[`${name}.csv`] = strToU8(toCsv(rows));
  }
  return files;
}

// Fixed timestamp, so rebuilding unchanged data gives byte-identical archives
const ZIP_OPTIONS = { level: 9, mtime: new Date(2026, 0, 1) } as const;

function zipped(key: string, build: () => Record<string, Files> | Files): Uint8Array {
  if (!zipCache.has(key)) zipCache.set(key, zipSync(build(), ZIP_OPTIONS));
  return zipCache.get(key)!;
}

export const cohortBundle = (dataset: string, cohort: string) =>
  zipped(`${dataset}/${cohort}`, () => cohortFiles(dataset, cohort));

/** Every cohort, as `<dataset>/<cohort>/<table>.csv`. */
export const fullBundle = () =>
  zipped('all', () =>
    Object.fromEntries(listCohorts().map(({ dataset, cohort }) => [`${dataset}/${cohort}`, cohortFiles(dataset, cohort)])),
  );

/** Bundle sizes in bytes, keyed by `<dataset>/<cohort>`, plus `all`. */
export function bundleSizes(): Record<string, number> {
  const sizes: Record<string, number> = { all: fullBundle().byteLength };
  for (const { dataset, cohort } of listCohorts()) sizes[`${dataset}/${cohort}`] = cohortBundle(dataset, cohort).byteLength;
  return sizes;
}
